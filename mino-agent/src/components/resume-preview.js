// Section headings alone are scaffolding, not a user's resume content.
export function hasResumeContent(resume) {
  const filled = value => typeof value === 'string' && value.trim().length > 0
  return ['name', 'contact', 'summary'].some(key => filled(resume?.[key])) ||
    (resume?.sections || []).some(section => (section.items || []).some(filled) ||
      (section.entries || []).some(entry => ['heading', 'subtitle', 'location', 'dates'].some(key => filled(entry[key])) || (entry.items || []).some(filled)))
}

export function originalPdfUrl(template) {
  try {
    const url = new URL(template?.originalPdfUrl)
    return ['http:', 'https:'].includes(url.protocol) ? url.href : ''
  } catch { return '' }
}
