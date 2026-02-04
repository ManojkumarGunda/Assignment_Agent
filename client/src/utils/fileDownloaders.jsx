import { buildReportHTML, buildStudentHTML, buildReportHTMLForSection } from './reportBuilders'

/**
 * Download report as DOC file
 */
export const downloadDoc = (result, summary, scores, title, lastTitle) => {
  if (!result && !summary && !(scores && scores.length)) return
  const html = buildReportHTML(scores, result, title, lastTitle, summary)
  const blob = new Blob([html], { type: 'application/msword' })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  const baseTitle = (lastTitle && lastTitle.trim()) || (title && title.trim()) || 'report'
  const safeTitle = baseTitle.replace(/[^a-z0-9-_ ]/gi, '').replace(/\s+/g, '_')
  a.download = `${safeTitle}.doc`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
}

/**
 * Download report as PDF
 */
export const downloadPdf = (result, summary, scores, title, lastTitle) => {
  if (!result && !summary && !(scores && scores.length)) return
  const html = buildReportHTML(scores, result, title, lastTitle, summary)
  const win = window.open('', '_blank')
  if (!win) return
  win.document.open()
  win.document.write(html)
  win.document.close()
  // Wait a tick for styles to apply, then trigger print (user can Save as PDF)
  win.focus()
  setTimeout(() => {
    win.print()
  }, 300)
}

/**
 * Build student text report
 */
export const buildStudentText = (student) => {
  const nm = (student && student.name) ? String(student.name) : 'Student'
  const scNum = typeof student?.score_percent === 'number' ? student.score_percent : Number(student?.score_percent)
  const sc = isFinite(scNum) ? scNum.toFixed(2) : (student?.score_percent ?? '-')
  const reason = (student && student.reasoning) ? String(student.reasoning) : ''
  const needImp = isFinite(scNum) && scNum >= 100 ? 'None' : (reason || '')
  const header = [
    `Student name: ${nm}`,
    `Score: ${sc}`,
    `Reason: ${reason}`,
    `Need to improve: ${needImp}`,
  ]
  if (student?.ppt_content || student?.design_evaluation) {
    const parts = ['']

    // PPT Content
    if (student.ppt_content) {
      const c = student.ppt_content
      parts.push('--- CONTENT EVALUATION ---')
      if (c.content_quality) parts.push(`Content Quality: ${c.content_quality.score}/100 - ${c.content_quality.feedback}`)
      if (c.structure) parts.push(`Structure: ${c.structure.score}/100 - ${c.structure.feedback}`)
      if (c.alignment) parts.push(`Alignment: ${c.alignment.score}/100 - ${c.alignment.feedback}`)

      if (Array.isArray(c.strengths) && c.strengths.length) {
        parts.push('\nStrengths:')
        c.strengths.forEach(s => parts.push(`- ${s}`))
      }

      if (Array.isArray(c.improvements) && c.improvements.length) {
        parts.push('\nAreas for Improvement:')
        c.improvements.forEach(s => parts.push(`- ${s}`))
      }
    }

    // PPT Design
    if (student.design_evaluation) {
      parts.push('\n--- VISUAL DESIGN EVALUATION ---')
      const d = student.design_evaluation
      if (d.error) {
        parts.push(`Design Evaluation Error: ${d.error}`)
      } else {
        if (d.visual_appeal) parts.push(`Visual Appeal: ${d.visual_appeal.score}/100 - ${d.visual_appeal.feedback}`)
        if (d.layout) parts.push(`Layout & Composition: ${d.layout.score}/100 - ${d.layout.feedback}`)
        if (d.typography) parts.push(`Typography: ${d.typography.score}/100 - ${d.typography.feedback}`)
        if (d.color_scheme) parts.push(`Color Scheme: ${d.color_scheme.score}/100 - ${d.color_scheme.feedback}`)

        if (d.overall_comment) parts.push(`\nOverall Design Comment: ${d.overall_comment}`)
      }
    }

    return header.concat(parts).join('\n')
  }

  const details = Array.isArray(student?.details) && student.details.length > 0
    ? ['', 'Per-question evaluation:'].concat(
      student.details.map((d, idx) => {
        const q = d?.question ? String(d.question) : '-'
        const sa = d?.student_answer ? String(d.student_answer) : '-'
        const ca = d?.correct_answer ? String(d.correct_answer) : '-'
        const res = d?.is_correct === true ? 'Correct' : (d?.partial_credit > 0 ? `Partial (${(d.partial_credit * 100).toFixed(0)}%)` : 'Incorrect')
        const fb = d?.feedback ? String(d.feedback) : ''
        return [
          `Q${idx + 1}: ${q}`,
          `Answer: ${sa}`,
          `Correct answer: ${ca}`,
          `Evaluation: ${res}`,
          (fb ? `Feedback: ${fb}` : ''),
        ].filter(Boolean).join('\n')
      })
    )
    : []
  return header.concat(details).join('\n')
}

/**
 * Download student report as TXT
 */
export const downloadStudentTxt = (student, index, title, lastTitle) => {
  if (!student) return
  const payload = buildStudentText(student)
  const blob = new Blob([payload], { type: 'text/plain' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  const now = new Date()
  const pad = (n) => String(n).padStart(2, '0')
  const baseTitle = (lastTitle && lastTitle.trim()) || (title && title.trim()) || 'report'
  const safeTitle = baseTitle.replace(/[^a-z0-9-_ ]/gi, '').replace(/\s+/g, '_')
  const studentName = (student.name || `Student_${index + 1}`).replace(/[^a-z0-9-_ ]/gi, '').replace(/\s+/g, '_')
  const fileName = `${safeTitle}_${studentName}_${pad(now.getDate())}-${pad(now.getMonth() + 1)}-${now.getFullYear()}_${pad(now.getHours())}-${pad(now.getMinutes())}.txt`
  a.download = fileName
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

/**
 * Download student report as PDF
 */
export const downloadStudentPdf = (student, index, title, lastTitle) => {
  if (!student) return
  const html = buildStudentHTML(student, title, lastTitle)
  const win = window.open('', '_blank')
  if (!win) return
  win.document.open()
  win.document.write(html)
  win.document.close()
  win.focus()
  setTimeout(() => {
    win.print()
  }, 300)
}

/**
 * Download student report as DOC
 */
export const downloadStudentDoc = (student, index, title, lastTitle) => {
  if (!student) return
  const html = buildStudentHTML(student, title, lastTitle)
  const blob = new Blob([html], { type: 'application/msword' })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  const baseTitle = (lastTitle && lastTitle.trim()) || (title && title.trim()) || 'report'
  const safeTitle = baseTitle.replace(/[^a-z0-9-_ ]/gi, '').replace(/\s+/g, '_')
  const studentName = (student.name || `Student_${index + 1}`).replace(/[^a-z0-9-_ ]/gi, '').replace(/\s+/g, '_')
  a.download = `${safeTitle}_${studentName}.doc`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
}

/**
 * Download result as TXT
 */
export const downloadResult = (result, summary, scores, title, lastTitle) => {
  const hasStructured = summary || (scores && scores.length > 0)
  if (!result && !hasStructured) return

  const payload = hasStructured
    ? (Array.isArray(scores) && scores.length > 0
      ? scores.map((s) => {
        const nm = (s && s.name) ? String(s.name) : '-'
        const scNum = typeof s?.score_percent === 'number' ? s.score_percent : Number(s?.score_percent)
        const sc = isFinite(scNum) ? scNum.toFixed(2) : (s?.score_percent ?? '-')
        const reason = (s && s.reasoning) ? String(s.reasoning) : ''
        const needImp = isFinite(scNum) && scNum >= 100 ? 'None' : (reason || '')
        const header = [
          `Student name: ${nm}`,
          `Score: ${sc}`,
          `Reason: ${reason}`,
          `Need to improve: ${needImp}`,
        ]
        const details = Array.isArray(s?.details) && s.details.length > 0
          ? ['', 'Per-question evaluation:'].concat(
            s.details.map((d, idx) => {
              const q = d?.question ? String(d.question) : '-'
              const sa = d?.student_answer ? String(d.student_answer) : '-'
              const ca = d?.correct_answer ? String(d.correct_answer) : '-'
              const res = d?.is_correct === true ? 'Correct' : (d?.partial_credit > 0 ? `Partial (${(d.partial_credit * 100).toFixed(0)}%)` : 'Incorrect')
              const fb = d?.feedback ? String(d.feedback) : ''
              return [
                `Q${idx + 1}: ${q}`,
                `Answer: ${sa}`,
                `Correct answer: ${ca}`,
                `Evaluation: ${res}`,
                (fb ? `Feedback: ${fb}` : ''),
              ].filter(Boolean).join('\n')
            })
          )
          : []
        return header.concat(details).join('\n')
      }).join('\n\n')
      : '')
    : result
  const blob = new Blob([payload], { type: 'text/plain' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  const now = new Date()
  const pad = (n) => String(n).padStart(2, '0')
  const baseTitle = (lastTitle && lastTitle.trim()) || (title && title.trim()) || 'output'
  const safeTitle = baseTitle.replace(/[^a-z0-9-_ ]/gi, '').replace(/\s+/g, '_')
  const fileName = `${safeTitle}_${pad(now.getDate())}-${pad(now.getMonth() + 1)}-${now.getFullYear()}_${pad(now.getHours())}-${pad(now.getMinutes())}.txt`
  a.download = fileName
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

/**
 * Download PPT section as TXT
 */
export const downloadPPTSectionTxt = (section, filename, title, lastTitle) => {
  const blob = new Blob([section], { type: 'text/plain' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  const now = new Date()
  const pad = (n) => String(n).padStart(2, '0')
  const baseTitle = (lastTitle && lastTitle.trim()) || (title && title.trim()) || 'report'
  const safeTitle = baseTitle.replace(/[^a-z0-9-_ ]/gi, '').replace(/\s+/g, '_')
  const safeFilename = filename.replace(/[^a-z0-9-_ ]/gi, '').replace(/\s+/g, '_')
  a.download = `${safeTitle}_${safeFilename}_${pad(now.getDate())}-${pad(now.getMonth() + 1)}-${now.getFullYear()}_${pad(now.getHours())}-${pad(now.getMinutes())}.txt`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

/**
 * Download PPT section as PDF
 */
export const downloadPPTSectionPdf = (section, filename, title, lastTitle) => {
  const html = buildReportHTMLForSection(section, filename, title, lastTitle)
  const win = window.open('', '_blank')
  if (!win) return
  win.document.open()
  win.document.write(html)
  win.document.close()
  win.focus()
  setTimeout(() => { win.print() }, 300)
}

/**
 * Download PPT section as DOC
 */
export const downloadPPTSectionDoc = (section, filename, title, lastTitle) => {
  const html = buildReportHTMLForSection(section, filename, title, lastTitle)
  const blob = new Blob([html], { type: 'application/msword' })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  const baseTitle = (lastTitle && lastTitle.trim()) || (title && title.trim()) || 'report'
  const safeTitle = baseTitle.replace(/[^a-z0-9-_ ]/gi, '').replace(/\s+/g, '_')
  const safeFilename = filename.replace(/[^a-z0-9-_ ]/gi, '').replace(/\s+/g, '_')
  a.download = `${safeTitle}_${safeFilename}.doc`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
}

