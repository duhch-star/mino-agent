"""文件接口：预签名直传 + 删除（本地开发用本地存储路径占位，生产换 OSS/COS）"""
from fastapi import APIRouter, Depends
from urllib.parse import quote

from app.api.deps import get_current_user
from app.core.responses import ok
from app.models.user import User
from app.schemas import PresignRequest

router = APIRouter(prefix="/files", tags=["文件"])

BASE = "https://oss.xiaomin.example.com"


@router.post("/presign")
def presign(req: PresignRequest, user: User = Depends(get_current_user)):
    object_key = f"users/{user.id}/{req.purpose}/{quote(req.filename)}"
    return ok(PresignOut(
        upload_url=f"{BASE}/{object_key}",
        object_key=object_key,
        expires_in=3600,
    ).model_dump())


@router.delete("/{object_key:path}")
def delete_file(object_key: str, user: User = Depends(get_current_user)):
    # 生产：调用对象存储删除接口；并清理授权记录
    return ok({"deleted": object_key, "note": "生产环境将同步删除对象存储文件"})