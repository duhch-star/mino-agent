"""前端适配层：/api/knowledge/* 学院 / 专业 / 教材章节目录"""
from fastapi import APIRouter, Depends

from app.core.responses import ApiException
from app.data import COLLEGES, TEXTBOOK_GROUPS, college_by_id, major_by_id
from app.models.user import User
from app.routers_fe.utils import get_optional_fe_user

router = APIRouter(prefix="/knowledge", tags=["FE-知识库"])


@router.get("/colleges")
def fe_colleges(user: User | None = Depends(get_optional_fe_user)):
    return COLLEGES


@router.get("/colleges/{college_id}")
def fe_college(college_id: str, user: User | None = Depends(get_optional_fe_user)):
    college = college_by_id(college_id)
    if not college:
        raise ApiException(40400, "学院不存在", status_code=404)
    return college


@router.get("/majors/{major_id}")
def fe_major(major_id: str, user: User | None = Depends(get_optional_fe_user)):
    found = major_by_id(major_id)
    if not found:
        raise ApiException(40400, "专业不存在", status_code=404)
    return found


@router.get("/textbooks")
def fe_textbooks(user: User | None = Depends(get_optional_fe_user)):
    return TEXTBOOK_GROUPS
