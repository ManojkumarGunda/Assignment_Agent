import * as XLSX from 'xlsx-js-style'

/**
 * Export scores to Excel with color-coded sections
 * @param {Array} rawScores - Array of score objects
 * @param {string} title - Title for the report
 * @param {string} lastTitle - Last used title
 * @returns {void}
 */
export const downloadExcel = (rawScores, title, lastTitle) => {
  if (rawScores.length === 0) return
  
  // Helper function to extract feedback from details array
  const extractFeedback = (student) => {
    if (!student || !Array.isArray(student.details) || student.details.length === 0) {
      return '-'
    }
    
    const feedbacks = student.details
      .map((detail, idx) => {
        const feedback = detail?.feedback
        if (feedback && typeof feedback === 'string' && feedback.trim()) {
          return `Q${idx + 1}: ${feedback.trim()}`
        }
        return null
      })
      .filter(f => f !== null)
    
    return feedbacks.length > 0 ? feedbacks.join(' | ') : '-'
  }
  
  // Filter valid numeric scores for calculations
  const validScores = rawScores
    .map(s => ({
      name: s.name || '-',
      score: typeof s.score_percent === 'number' ? s.score_percent : null,
      score_percent: s.score_percent,
      reasoning: s.reasoning || '-',
      feedback: extractFeedback(s)
    }))
    .filter(s => s.score !== null && !isNaN(s.score))
  
  // Calculate statistics
  const scoresArray = validScores.map(s => s.score)
  const average = scoresArray.length > 0 
    ? (scoresArray.reduce((a, b) => a + b, 0) / scoresArray.length).toFixed(2)
    : 'N/A'
  
  // Find highest students (handle ties)
  const maxScore = scoresArray.length > 0 ? Math.max(...scoresArray) : null
  const highestStudents = maxScore !== null
    ? validScores.filter(s => Math.abs(s.score - maxScore) < 0.01)
    : []
  
  // Find lowest students (handle ties)
  const minScore = scoresArray.length > 0 ? Math.min(...scoresArray) : null
  const lowestStudents = minScore !== null
    ? validScores.filter(s => Math.abs(s.score - minScore) < 0.01)
    : []
  
  // Build Excel data with summary at top
  const excelData = []
  let currentRow = 0
  
  // Track row ranges for styling
  const styleRanges = {
    summaryHeader: { start: currentRow, end: currentRow },
    averageRow: { start: currentRow + 1, end: currentRow + 1 },
    highestHeader: null,
    highestRows: [],
    lowestHeader: null,
    lowestRows: [],
    allScoresHeader: null,
    allScoresRows: []
  }
  
  // Add summary section with clear heading
  excelData.push({ 'Student Name': '📊 PERFORMANCE SUMMARY', 'Score (%)': '', 'Reasoning': '', 'Feedback': '' })
  currentRow++
  excelData.push({ 'Student Name': `Average Score of All Students`, 'Score (%)': `${average}%`, 'Reasoning': `Based on ${validScores.length} student(s)`, 'Feedback': '' })
  currentRow++
  excelData.push({ 'Student Name': '', 'Score (%)': '', 'Reasoning': '', 'Feedback': '' })
  currentRow++
  
  // Add highest students with clear heading
  if (highestStudents.length > 0) {
    styleRanges.highestHeader = { start: currentRow, end: currentRow }
    excelData.push({ 
      'Student Name': `🏆 TOP PERFORMERS - Highest Score: ${maxScore.toFixed(2)}% (${highestStudents.length} student${highestStudents.length > 1 ? 's' : ''})`, 
      'Score (%)': '', 
      'Reasoning': '',
      'Feedback': ''
    })
    currentRow++
    const highestStartRow = currentRow
    highestStudents.forEach(student => {
      excelData.push({
        'Student Name': student.name,
        'Score (%)': student.score.toFixed(2),
        'Reasoning': student.reasoning,
        'Feedback': student.feedback || '-'
      })
      currentRow++
    })
    styleRanges.highestRows = { start: highestStartRow, end: currentRow - 1 }
    excelData.push({ 'Student Name': '', 'Score (%)': '', 'Reasoning': '', 'Feedback': '' })
    currentRow++
  }
  
  // Add lowest students with clear heading
  if (lowestStudents.length > 0) {
    styleRanges.lowestHeader = { start: currentRow, end: currentRow }
    excelData.push({ 
      'Student Name': `⚠️ NEEDS ATTENTION - Lowest Score: ${minScore.toFixed(2)}% (${lowestStudents.length} student${lowestStudents.length > 1 ? 's' : ''})`, 
      'Score (%)': '', 
      'Reasoning': '',
      'Feedback': ''
    })
    currentRow++
    const lowestStartRow = currentRow
    lowestStudents.forEach(student => {
      excelData.push({
        'Student Name': student.name,
        'Score (%)': student.score.toFixed(2),
        'Reasoning': student.reasoning,
        'Feedback': student.feedback || '-'
      })
      currentRow++
    })
    styleRanges.lowestRows = { start: lowestStartRow, end: currentRow - 1 }
    excelData.push({ 'Student Name': '', 'Score (%)': '', 'Reasoning': '', 'Feedback': '' })
    currentRow++
  }
  
  // Add separator with clear heading
  styleRanges.allScoresHeader = { start: currentRow, end: currentRow }
  excelData.push({ 
    'Student Name': `📋 COMPLETE STUDENT LIST - All ${rawScores.length} Student${rawScores.length > 1 ? 's' : ''} (Sorted by Score: Highest to Lowest)`, 
    'Score (%)': '', 
    'Reasoning': '',
    'Feedback': ''
  })
  currentRow++
  excelData.push({ 'Student Name': '', 'Score (%)': '', 'Reasoning': '', 'Feedback': '' })
  currentRow++
  
  // Add all student scores (sorted by score descending)
  const sortedScores = [...rawScores].sort((a, b) => {
    const scoreA = typeof a.score_percent === 'number' ? a.score_percent : -1
    const scoreB = typeof b.score_percent === 'number' ? b.score_percent : -1
    return scoreB - scoreA
  })
  
  const allScoresStartRow = currentRow
  sortedScores.forEach(s => {
    excelData.push({
      'Student Name': s.name || '-',
      'Score (%)': typeof s.score_percent === 'number' ? s.score_percent.toFixed(2) : s.score_percent || '-',
      'Reasoning': s.reasoning || '-',
      'Feedback': extractFeedback(s)
    })
    currentRow++
  })
  styleRanges.allScoresRows = { start: allScoresStartRow, end: currentRow - 1 }
  
  // Create workbook and worksheet
  const ws = XLSX.utils.json_to_sheet(excelData)
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Student Scores')
  
  // Set column widths
  const colWidths = [
    { wch: 40 }, // Student Name (wider for summary headers)
    { wch: 15 }, // Score (%)
    { wch: 60 }, // Reasoning
    { wch: 70 }  // Feedback
  ]
  ws['!cols'] = colWidths
  
  // Helper function to apply styles to a range
  const applyStyle = (startRow, endRow, style) => {
    for (let row = startRow; row <= endRow; row++) {
      ['A', 'B', 'C', 'D'].forEach(col => {
        const cellAddress = `${col}${row + 1}` // +1 because Excel is 1-indexed
        if (!ws[cellAddress]) return
        ws[cellAddress].s = style
      })
    }
  }
  
  // Helper function to apply styles only to Feedback column (column D)
  const applyFeedbackColumnStyle = (startRow, endRow, style) => {
    for (let row = startRow; row <= endRow; row++) {
      const cellAddress = `D${row + 1}` // +1 because Excel is 1-indexed
      if (!ws[cellAddress]) return
      // Merge with existing style if present
      const existingStyle = ws[cellAddress].s || {}
      ws[cellAddress].s = {
        ...existingStyle,
        ...style,
        fill: style.fill || existingStyle.fill,
        font: style.font || existingStyle.font,
        alignment: style.alignment || existingStyle.alignment
      }
    }
  }
  
  // Define color styles
  const styles = {
    // Summary header: Dark blue background, white text, bold, larger font
    summaryHeader: {
      fill: { fgColor: { rgb: '1F4E78' } }, // Dark blue
      font: { color: { rgb: 'FFFFFF' }, bold: true, sz: 14 },
      alignment: { horizontal: 'left', vertical: 'center', wrapText: true }
    },
    // Average row: Light blue background, bold
    averageRow: {
      fill: { fgColor: { rgb: 'D9E1F2' } }, // Light blue
      font: { bold: true, sz: 12 },
      alignment: { vertical: 'center' }
    },
    // Highest students header: Dark green background, white text, bold, larger font
    highestHeader: {
      fill: { fgColor: { rgb: '70AD47' } }, // Dark green
      font: { color: { rgb: 'FFFFFF' }, bold: true, sz: 14 },
      alignment: { horizontal: 'left', vertical: 'center', wrapText: true }
    },
    // Highest students rows: Light green background
    highestRows: {
      fill: { fgColor: { rgb: 'E2EFDA' } }, // Light green
      font: { sz: 11 },
      alignment: { vertical: 'center' }
    },
    // Lowest students header: Dark red/orange background, white text, bold, larger font
    lowestHeader: {
      fill: { fgColor: { rgb: 'C55A11' } }, // Dark orange/red
      font: { color: { rgb: 'FFFFFF' }, bold: true, sz: 14 },
      alignment: { horizontal: 'left', vertical: 'center', wrapText: true }
    },
    // Lowest students rows: Light red/orange background
    lowestRows: {
      fill: { fgColor: { rgb: 'FCE4D6' } }, // Light orange/red
      font: { sz: 11 },
      alignment: { vertical: 'center' }
    },
    // All scores header: Dark blue-gray background, white text, bold, larger font
    allScoresHeader: {
      fill: { fgColor: { rgb: '4472C4' } }, // Dark blue-gray
      font: { color: { rgb: 'FFFFFF' }, bold: true, sz: 14 },
      alignment: { horizontal: 'left', vertical: 'center', wrapText: true }
    },
    // Regular student rows: White/light gray alternating (zebra striping)
    regularRowEven: {
      fill: { fgColor: { rgb: 'FFFFFF' } }, // White
      font: { sz: 11 },
      alignment: { vertical: 'center' }
    },
    regularRowOdd: {
      fill: { fgColor: { rgb: 'F2F2F2' } }, // Light gray
      font: { sz: 11 },
      alignment: { vertical: 'center' }
    },
    // Header row style
    headerRow: {
      fill: { fgColor: { rgb: '366092' } }, // Dark blue
      font: { color: { rgb: 'FFFFFF' }, bold: true, sz: 11 },
      alignment: { horizontal: 'center', vertical: 'center' }
    },
    // Feedback column style: Light lavender/purple background for better visibility
    feedbackColumn: {
      fill: { fgColor: { rgb: 'E7E6F7' } }, // Light lavender/purple
      font: { sz: 10, italic: false },
      alignment: { horizontal: 'left', vertical: 'top', wrapText: true }
    },
    // Feedback column for header (darker purple)
    feedbackColumnHeader: {
      fill: { fgColor: { rgb: '7C6BC8' } }, // Medium purple
      font: { color: { rgb: 'FFFFFF' }, bold: true, sz: 11 },
      alignment: { horizontal: 'center', vertical: 'center' }
    }
  }
  
  // Apply header row style (row 1) - including Feedback column header
  applyStyle(0, 0, styles.headerRow)
  applyFeedbackColumnStyle(0, 0, styles.feedbackColumnHeader)
  
  // Apply summary header style
  applyStyle(styleRanges.summaryHeader.start, styleRanges.summaryHeader.end, styles.summaryHeader)
  
  // Apply average row style
  applyStyle(styleRanges.averageRow.start, styleRanges.averageRow.end, styles.averageRow)
  
  // Apply highest students styles
  if (styleRanges.highestHeader) {
    applyStyle(styleRanges.highestHeader.start, styleRanges.highestHeader.end, styles.highestHeader)
  }
  if (styleRanges.highestRows.start !== undefined) {
    applyStyle(styleRanges.highestRows.start, styleRanges.highestRows.end, styles.highestRows)
    // Apply Feedback column style to highest students rows
    applyFeedbackColumnStyle(styleRanges.highestRows.start, styleRanges.highestRows.end, styles.feedbackColumn)
  }
  
  // Apply lowest students styles
  if (styleRanges.lowestHeader) {
    applyStyle(styleRanges.lowestHeader.start, styleRanges.lowestHeader.end, styles.lowestHeader)
  }
  if (styleRanges.lowestRows.start !== undefined) {
    applyStyle(styleRanges.lowestRows.start, styleRanges.lowestRows.end, styles.lowestRows)
    // Apply Feedback column style to lowest students rows
    applyFeedbackColumnStyle(styleRanges.lowestRows.start, styleRanges.lowestRows.end, styles.feedbackColumn)
  }
  
  // Apply all scores header style
  if (styleRanges.allScoresHeader) {
    applyStyle(styleRanges.allScoresHeader.start, styleRanges.allScoresHeader.end, styles.allScoresHeader)
  }
  
  // Apply zebra striping to all student scores rows
  if (styleRanges.allScoresRows.start !== undefined) {
    for (let row = styleRanges.allScoresRows.start; row <= styleRanges.allScoresRows.end; row++) {
      const isEven = (row - styleRanges.allScoresRows.start) % 2 === 0
      const style = isEven ? styles.regularRowEven : styles.regularRowOdd
      applyStyle(row, row, style)
    }
    // Apply Feedback column style to all student scores rows
    applyFeedbackColumnStyle(styleRanges.allScoresRows.start, styleRanges.allScoresRows.end, styles.feedbackColumn)
  }
  
  // Generate Excel file
  const now = new Date()
  const pad = (n) => String(n).padStart(2, '0')
  const baseTitle = (lastTitle && lastTitle.trim()) || (title && title.trim()) || 'report'
  const safeTitle = baseTitle.replace(/[^a-z0-9-_ ]/gi, '').replace(/\s+/g, '_')
  const fileName = `${safeTitle}_scores_${pad(now.getDate())}-${pad(now.getMonth() + 1)}-${now.getFullYear()}_${pad(now.getHours())}-${pad(now.getMinutes())}.xlsx`
  
  XLSX.writeFile(wb, fileName)
}

