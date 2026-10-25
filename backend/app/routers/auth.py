"""认证接口：注册/登录/刷新/验证码/资料/注销"""
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.core.responses import ApiException, ok
from app.db.session import get_db
from app.models.user import User
from app.schemas import (LoginRequest, RefreshRequest, RegisterRequest, TokenOut,
                         UpdateProfileRequest, UserOut, VerifyCodeRequest)
from app.services import user_service

router = APIRouter(prefix="/auth", tags=["认证"])


def _token_out(db: Session, user: User) -> dict:
    tokens = user_service.issue_token_pair(db, user)
    tokens["user"] = UserOut.model_validate(user).model_dump(mode="json")
    return ok(tokens)


@router.post("/register")
def register(req: RegisterRequest, db: Session = Depends(get_db)):
    if user_service.get_by_account(db, req.account):
        raise ApiException(40002, "账号已注册")
    user_service.check_verify_code(db, req.account, "register", req.code)
    user = user_service.create_user(db, req.account, req.password)
    return _token_out(db, user)


@router.post("/login")
def login(req: LoginRequest, db: Session = Depends(get_db)):
    user = user_service.get_by_account(db, req.account)
    if not user or not user_service.verify_password(req.password, user.password_hash):
        raise ApiException(40003, "账号或密码错误")
    if not user.is_active:
        raise ApiException(40300, "账号已禁用")
    return _token_out(db, user)


@router.post("/refresh", response_model=TokenOut)
def refresh(req: RefreshRequest, db: Session = Depends(get_db)):
    return user_service.rotate_refresh(db, req.refresh_token)


@router.post("/logout")
def logout(req: RefreshRequest, db: Session = Depends(get_db)):
    user_service.rotate_refresh(db, req.refresh_token)  # 轮换即吊销旧 refresh
    return ok({})


@router.post("/verify-code")
def send_verify_code(req: VerifyCodeRequest, db: Session = Depends(get_db)):
    code = user_service.create_verify_code(db, req.account, req.scene)
    # 开发环境直接返回；生产走短信/邮件渠道
    return ok({"code": code, "dev_note": "生产环境改为短信/邮件发送，不返回明文"})


@router.get("/me")
def me(user: User = Depends(get_current_user)):
    return ok(UserOut.model_validate(user).model_dump(mode="json"))


@router.put("/me")
def update_me(req: UpdateProfileRequest, user: User = Depends(get_current_user),
              db: Session = Depends(get_db)):
    for field, value in req.model_dump(exclude_none=True).items():
        setattr(user, field, value)
    db.commit()
    db.refresh(user)
    return ok(UserOut.model_validate(user).model_dump(mode="json"))


@router.delete("/me")
def delete_me(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    # 级联删除：进度/收藏/笔记/问答/面试会话/录音元信息（实现见 service）
    from app.models.interview import InterviewSession, QaHistory
    from app.models.study import Progress, Favorite, Note
    for model in (Progress, Favorite, Note, QaHistory, InterviewSession):
        db.query(model).filter(model.user_id == user.id).delete()
    db.delete(user)
    db.commit()
    return ok({})