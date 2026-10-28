"""Shared plain-text resume schemas (router imports remain backwards compatible)."""
from typing import Literal
from pydantic import BaseModel, ConfigDict, Field


class Entry(BaseModel):
    heading: str = Field(default='', max_length=200)
    subtitle: str = Field(default='', max_length=300)
    location: str = Field(default='', max_length=200)
    dates: str = Field(default='', max_length=100)
    items: list[str] = Field(default_factory=list, max_length=30)


class Section(BaseModel):
    title: str = Field(max_length=80)
    items: list[str] = Field(default_factory=list, max_length=30)
    entries: list[Entry] = Field(default_factory=list, max_length=20)
    column: str = Field(default='auto', pattern='^(auto|left|right)$')


class Resume(BaseModel):
    name: str = Field(default='', max_length=100)
    contact: str = Field(default='', max_length=500)
    summary: str = Field(default='', max_length=3000)
    sections: list[Section] = Field(default_factory=list, max_length=15)


Template = Literal['classic', 'sidebar']


class DocumentWrite(BaseModel):
    model_config = ConfigDict(extra='forbid')
    resume: Resume
    template: Template
    expectedRevision: int = Field(ge=0, strict=True)


class ResumeUpdate(BaseModel):
    model_config = ConfigDict(extra='forbid')
    resume: Resume
    expectedRevision: int = Field(ge=0, strict=True)


class DocumentUndo(BaseModel):
    model_config = ConfigDict(extra='forbid')
    expectedRevision: int = Field(ge=0, strict=True)


class TemplateUpdate(BaseModel):
    model_config = ConfigDict(extra='forbid')
    template: Template
    expectedRevision: int = Field(ge=0, strict=True)
