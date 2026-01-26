/**
 * Split PPT combined result into per-file sections (handles design/content combined output)
 */
export const splitPPTFileSections = (text) => {
  if (!text || typeof text !== 'string') return []
  
  // Split by double newlines (backend separates files with "\n\n")
  const parts = text.split(/\n\n+/).filter(p => p.trim().length > 0)
  
  const fileSections = []
  let currentFile = ''
  let currentFilename = ''
  
  for (const part of parts) {
    const trimmed = part.trim()
    
    // Extract filename from this part
    const fileMatch = trimmed.match(/^File:\s+([^\n]+)/m)
    const extractedFilename = fileMatch ? fileMatch[1].trim() : null
    
    // Check if this is a main file header: starts with "File:" + "Total Slides:" BEFORE eval markers
    const startsWithFile = /^File:\s+[^\n]+/m.test(trimmed)
    const hasTotalSlides = trimmed.includes('\nTotal Slides:')
    const hasEvalMarkers = trimmed.includes('CONTENT EVALUATION') || trimmed.includes('VISUAL DESIGN EVALUATION')
    
    // Main header: has File + Total Slides, and eval markers come AFTER (or don't exist)
    const fileIndex = trimmed.indexOf('File:')
    const totalSlidesIndex = trimmed.indexOf('Total Slides:')
    const contentEvalIndex = trimmed.indexOf('CONTENT EVALUATION')
    const designEvalIndex = trimmed.indexOf('VISUAL DESIGN EVALUATION')
    const firstEvalIndex = Math.min(
      contentEvalIndex === -1 ? Infinity : contentEvalIndex,
      designEvalIndex === -1 ? Infinity : designEvalIndex
    )
    
    const isMainFileHeader = startsWithFile && hasTotalSlides && 
      fileIndex < totalSlidesIndex &&
      (firstEvalIndex === Infinity || totalSlidesIndex < firstEvalIndex)
    
    // Check if this belongs to current file (same filename)
    const belongsToCurrentFile = currentFilename && extractedFilename && 
      extractedFilename === currentFilename
    
    if (isMainFileHeader && (!currentFilename || extractedFilename !== currentFilename)) {
      // New file - save previous
      if (currentFile) {
        fileSections.push(currentFile.trim())
      }
      currentFile = trimmed
      currentFilename = extractedFilename || ''
    } else if (belongsToCurrentFile || (!extractedFilename && currentFile)) {
      // Same file - continue building
      currentFile += '\n\n' + trimmed
    } else if (!currentFile) {
      // First part
      currentFile = trimmed
      currentFilename = extractedFilename || ''
    } else {
      // Continuation (no File header) - add to current
      currentFile += '\n\n' + trimmed
    }
  }
  
  // Add last file
  if (currentFile) {
    fileSections.push(currentFile.trim())
  }
  
  return fileSections.length > 0 ? fileSections : [text]
}

/**
 * Extract scores from PPT results if not already in scores array
 */
export const extractPPTScores = (result) => {
  if (!result || typeof result !== 'string') return []
  
  const pptScores = []
  const fileSections = splitPPTFileSections(result)
  
  for (const section of fileSections) {
    // Extract filename
    const filenameMatch = section.match(/^File:\s*([^\n]+)/m)
    const filename = filenameMatch ? filenameMatch[1].trim() : 'Unknown'
    
    // Try to extract scores from content evaluation
    let score = null
    let reasoning = ''
    
    // Look for Content Quality Score
    const contentScoreMatch = section.match(/Content Quality Score:\s*(\d+)\/100/)
    const structureScoreMatch = section.match(/Structure Score:\s*(\d+)\/100/)
    const alignmentScoreMatch = section.match(/Alignment Score:\s*(\d+)\/100/)
    
    if (contentScoreMatch || structureScoreMatch || alignmentScoreMatch) {
      const scores = [
        contentScoreMatch ? parseInt(contentScoreMatch[1]) : null,
        structureScoreMatch ? parseInt(structureScoreMatch[1]) : null,
        alignmentScoreMatch ? parseInt(alignmentScoreMatch[1]) : null
      ].filter(s => s !== null)
      
      if (scores.length > 0) {
        score = scores.reduce((a, b) => a + b, 0) / scores.length
      }
    }
    
    // Extract feedback/reasoning
    const feedbackMatches = section.match(/Feedback:\s*([^\n]+(?:\n(?!\n|Score|File:)[^\n]+)*)/g)
    if (feedbackMatches) {
      reasoning = feedbackMatches.map(m => m.replace(/^Feedback:\s*/, '')).join('; ')
    }
    
    if (filename && (score !== null || reasoning)) {
      pptScores.push({
        name: filename,
        score_percent: score !== null ? score : '-',
        reasoning: reasoning || 'Evaluation completed'
      })
    }
  }
  
  return pptScores
}

