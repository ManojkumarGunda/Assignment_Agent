import { useState, useEffect } from 'react'
import Navbar from './Navbar'
import api from '../api/axios'
import GitHubRepo from './GitHubRepo'
import PPTUpload from './PPTUpload'
import { downloadExcel } from '../utils/excelExport'
import { buildReportHTML, buildStudentHTML, buildReportHTMLForSection } from '../utils/reportBuilders'
import {
  downloadDoc,
  downloadPdf,
  downloadStudentTxt,
  downloadStudentPdf,
  downloadStudentDoc,
  downloadResult,
  downloadPPTSectionTxt,
  downloadPPTSectionPdf,
  downloadPPTSectionDoc
} from '../utils/fileDownloaders'
import { splitPPTFileSections, extractPPTScores } from '../utils/pptProcessors'
import { formatLabel, parseJsonResult, renderJsonResult, isValidGitHubUrl, formatFileSize } from '../utils/helpers'

import { useAuth } from '../contexts/AuthContext'

const Services = () => {
  const { user } = useAuth()
  const [files, setFiles] = useState([])
  const [pptFiles, setPptFiles] = useState([])
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [isGenerating, setIsGenerating] = useState(false)
  const [dragActive, setDragActive] = useState(false)
  const [pptDragActive, setPptDragActive] = useState(false)
  const [result, setResult] = useState('')
  const [summary, setSummary] = useState('')
  const [scores, setScores] = useState([])
  const [error, setError] = useState('')
  const [uploadedFileIds, setUploadedFileIds] = useState([])
  const [fileIdsMap, setFileIdsMap] = useState({}) // Map student name to file_id for re-evaluation
  const [lastDescription, setLastDescription] = useState('') // Store description for re-evaluation
  const [openrouterStatus, setOpenrouterStatus] = useState(null)
  const [lastTitle, setLastTitle] = useState('')
  const [githubUrl, setGithubUrl] = useState('')
  const [mode, setMode] = useState(null) // null | 'files' | 'github' | 'ppt'
  const [evaluateDesign, setEvaluateDesign] = useState(false) // For PPT: evaluate design vs content
  const [reevaluating, setReevaluating] = useState({}) // Track which student is being re-evaluated
  const [searchTerm, setSearchTerm] = useState('')
  const [scoreFilter, setScoreFilter] = useState('all') // 'all' | 'high' | 'mid' | 'low'


  const handleFiles = (selectedFiles) => {
    const acceptedExtensions = ['.pdf', '.txt', '.doc', '.docx']
    const fileArray = Array.from(selectedFiles)
    const validFiles = []
    let hasInvalid = false

    fileArray.forEach(f => {
      const ext = f.name.toLowerCase().substring(f.name.lastIndexOf('.'))
      if (acceptedExtensions.includes(ext)) {
        validFiles.push(f)
      } else {
        hasInvalid = true
      }
    })

    if (hasInvalid) {
      alert('Invalid file! Only PDF, Text, DOC, and DOCX files are allowed.')
    }

    if (validFiles.length > 0) {
      setFiles(prev => [...prev, ...validFiles])
    }
  }

  const handleDrag = (e) => {
    e.preventDefault()
    e.stopPropagation()
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true)
    } else if (e.type === 'dragleave') {
      setDragActive(false)
    }
  }

  const handleDrop = (e) => {
    e.preventDefault()
    e.stopPropagation()
    setDragActive(false)

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFiles(e.dataTransfer.files)
    }
  }

  const handleFileInput = (e) => {
    if (e.target.files && e.target.files[0]) {
      handleFiles(e.target.files)
    }
  }

  const removeFile = (index) => {
    setFiles(prev => prev.filter((_, i) => i !== index))
  }

  const removePPTFile = (index) => {
    setPptFiles(prev => prev.filter((_, i) => i !== index))
  }

  const handlePPTDrag = (e) => {
    e.preventDefault()
    e.stopPropagation()
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setPptDragActive(true)
    } else if (e.type === 'dragleave') {
      setPptDragActive(false)
    }
  }

  const handlePPTDrop = (e) => {
    e.preventDefault()
    e.stopPropagation()
    setPptDragActive(false)
  }

  useEffect(() => {
    // Check Ollama status on component mount
    checkOpenRouterStatus()
    // Check if re-evaluate endpoint is available
    checkReevaluateEndpoint()
  }, [])

  const checkOpenRouterStatus = async () => {
    try {
      const response = await api.get('/system/openrouter/status')
      setOpenrouterStatus(response.data)
    } catch (err) {
      setOpenrouterStatus({ connected: false })
    }
  }

  // Check if re-evaluate endpoint is available
  const checkReevaluateEndpoint = async () => {
    try {
      const response = await api.get('/reevaluate/health')
      console.log('Re-evaluate endpoint is available:', response.data)
      return true
    } catch (err) {
      console.error('Re-evaluate endpoint check failed:', err)
      return false
    }
  }

  const parsedJsonResult = parseJsonResult(result)

  // Wrapper function for Excel export that handles mode-specific logic
  const handleDownloadExcel = () => {
    let rawScores = []

    // Get scores from scores array or extract from PPT results
    if (mode === 'ppt' && (!scores || scores.length === 0)) {
      rawScores = extractPPTScores(result)
    } else if (scores && scores.length > 0) {
      rawScores = scores
    } else {
      // No scores available
      return
    }

    if (rawScores.length === 0) return

    downloadExcel(rawScores, title, lastTitle)
  }

  const handleGenerate = async () => {
    if (mode === 'files') {
      if (!title.trim()) {
        setError('Please enter a title')
        return
      }
      if (!description.trim()) {
        setError('Please enter a description')
        return
      }
      if (files.length === 0) {
        setError('Please upload at least one file')
        return
      }
    } else if (mode === 'ppt') {
      if (!title.trim()) {
        setError('Please enter a title')
        return
      }
      if (!description.trim()) {
        setError('Please enter a description')
        return
      }
      if (pptFiles.length === 0) {
        setError('Please upload at least one PPT file')
        return
      }
    } else if (mode === 'github') {
      if (!isValidGitHubUrl(githubUrl)) {
        setError('Please enter a valid public GitHub repository URL')
        return
      }
      if (!description.trim()) {
        setError('Please enter rules/description for how the GitHub repo should be evaluated')
        return
      }
    }

    setIsGenerating(true)
    const usedTitle = title.trim()
    setLastTitle(usedTitle)
    setError('')
    setResult('')
    setSummary('')
    setScores([])
    setReevaluating({})

    try {
      // Step 1: Upload files (only if in files or ppt mode)
      let fileIds = []
      if (mode === 'files') {
        const formData = new FormData()
        files.forEach(file => {
          formData.append('files', file)
        })
        const uploadResponse = await api.post('/files/upload', formData)
        if (!uploadResponse.data.success) {
          throw new Error('File upload failed')
        }
        fileIds = uploadResponse.data.file_ids
        setUploadedFileIds(fileIds)
      } else if (mode === 'ppt') {
        const formData = new FormData()
        pptFiles.forEach(file => {
          formData.append('files', file)
        })
        const uploadResponse = await api.post('/files/upload', formData)
        if (!uploadResponse.data.success) {
          throw new Error('PPT file upload failed')
        }
        fileIds = uploadResponse.data.file_ids
        setUploadedFileIds(fileIds)
      }

      // Step 2: Generate content or evaluate/grade GitHub repo
      let response
      if (mode === 'github') {
        // Use GitHub grading endpoint - evaluates repo against user rules/description
        try {
          response = await api.post('/github/grade', {
            github_url: githubUrl.trim(),
            description: description.trim(),
          })
        } catch (err) {
          // Enhanced error handling for debugging
          if (err.response) {
            // Server responded with error status
            throw new Error(err.response?.data?.detail || err.response?.data?.error || `Server error: ${err.response.status}`)
          } else if (err.request) {
            // Request made but no response (network error, backend not running)
            throw new Error('Cannot connect to server. Please ensure the backend server is running on http://localhost:8000')
          } else {
            // Something else happened
            throw new Error(err.message || 'An unexpected error occurred')
          }
        }

        if (response.data.success) {
          // Build beautiful human-readable output, NO JSON FALLBACK
          const grading = response.data.result || {}
          let gradingData = grading
          // Handle potential double-nesting from backend
          if (gradingData.success && gradingData.result) {
            gradingData = gradingData.result
          }

          const ruleResultsRaw = Array.isArray(gradingData.rule_results) ? gradingData.rule_results : []
          const formattedRules = ruleResultsRaw.length
            ? ruleResultsRaw.map((r, i) => `Rule ${i + 1}: ${r.rule_text || '-'}\n   Satisfied: ${r.is_satisfied ? 'Yes' : 'No'}\n   Reasoning: ${r.evidence || r.failure_reason || '-'}`).join('\n\n')
            : 'No automated rule violations detected.'

          const techStack = Array.isArray(gradingData.detected_technology_stack) ? gradingData.detected_technology_stack.join(', ') : 'Multiple Frameworks'

          const cleanSummary = [
            `OVERALL ASSESSMENT: ${gradingData.overall_comment || 'Audit Complete'}`,
            `SCORE: ${typeof gradingData.score_percent === 'number' ? gradingData.score_percent.toFixed(0) : gradingData.score_percent}%`,
            `DETECTED STACK: ${techStack}`,
            `RULES SUMMARY:\n${gradingData.rules_summary || 'Standard compliance check finalized.'}`,
            `DETAILED AUDIT LOG:\n${formattedRules}`
          ].join('\n\n')

          setResult(cleanSummary)
          setSummary(cleanSummary)
          setScores([{
            name: "Repository Audit",
            score_percent: gradingData.score_percent || 0,
            reasoning: gradingData.overall_comment || gradingData.rules_summary || "Automated repository audit finalized with precision formatting.",
            details: []
          }])
        } else {
          setError(response.data.error || 'GitHub grading failed')
        }
      } else {
        // Use file upload grading endpoint (for both files and ppt modes)
        response = await api.post('/files/generate', {
          title: title.trim(),
          description: description.trim(),
          file_ids: fileIds,
          github_url: null,
          evaluate_design: mode === 'ppt' ? evaluateDesign : false
        })

        if (response.data.success) {
          setResult(response.data.result || '')
          if (response.data.summary) setSummary(response.data.summary)
          if (Array.isArray(response.data.scores)) {
            setScores(response.data.scores)
            // Build file_ids map for re-evaluation using index-based mapping
            const idsMap = {}
            if (Array.isArray(response.data.file_ids) && response.data.file_ids.length > 0) {
              // Map by index: score at index i corresponds to file_id at index i
              response.data.scores.forEach((score, idx) => {
                if (idx < response.data.file_ids.length && response.data.file_ids[idx]) {
                  // Store by both name and index for reliability
                  if (score.name) {
                    idsMap[score.name] = response.data.file_ids[idx]
                  }
                  // Also store by index
                  idsMap[`__index_${idx}`] = response.data.file_ids[idx]
                }
              })
              console.log('File IDs map built:', idsMap, 'File IDs:', response.data.file_ids, 'Scores:', response.data.scores)
            } else {
              console.warn('No file_ids received in response:', response.data)
              // Fallback: use uploadedFileIds if available
              if (Array.isArray(uploadedFileIds) && uploadedFileIds.length > 0) {
                console.log('Using uploadedFileIds as fallback for fileIdsMap')
                uploadedFileIds.forEach((fileId, idx) => {
                  if (idx < response.data.scores.length && response.data.scores[idx]?.name) {
                    idsMap[response.data.scores[idx].name] = fileId
                  }
                  idsMap[`__index_${idx}`] = fileId
                })
              }
            }
            setFileIdsMap(idsMap)
            console.log('Final fileIdsMap:', idsMap)
          }
          // Store title and description for re-evaluation - DON'T clear them
          // Keep them available until page refresh
          setLastTitle(title.trim())
          setLastDescription(description.trim())
          // DON'T clear files - keep them visible until page refresh
          // This allows users to see what files were uploaded and re-evaluate if needed
          // Files will only be cleared when:
          // 1. User manually removes them using the remove button
          // 2. User refreshes the page
          // 3. User uploads new files (which will replace the old ones)
          // if (mode === 'files') {
          //   setFiles([])
          // } else if (mode === 'ppt') {
          //   setPptFiles([])
          // }
          // DON'T clear title and description - keep for re-evaluation
          // setTitle('')
          // setDescription('')
        } else {
          setError(response.data.error || 'Generation failed')
        }
      }
    } catch (err) {
      setError(err.response?.data?.detail || err.message || 'An error occurred during generation')
    } finally {
      setIsGenerating(false)
    }
  }

  const handleDownloadResult = () => {
    downloadResult(result, summary, scores, title, lastTitle)
  }

  const handleDownloadDoc = () => {
    downloadDoc(result, summary, scores, title, lastTitle)
  }

  const handleDownloadPdf = () => {
    downloadPdf(result, summary, scores, title, lastTitle)
  }

  const handleDownloadStudentTxt = (student, index) => {
    downloadStudentTxt(student, index, title, lastTitle)
  }

  const handleDownloadStudentPdf = (student, index) => {
    downloadStudentPdf(student, index, title, lastTitle)
  }

  const handleDownloadStudentDoc = (student, index) => {
    downloadStudentDoc(student, index, title, lastTitle)
  }

  const handleReevaluate = async (student, index) => {
    const studentName = student.name || `Student ${index + 1}`

    // Try multiple ways to get file_id
    let fileId = fileIdsMap[studentName] || fileIdsMap[`__index_${index}`]

    // Fallback: try to use uploadedFileIds by index if fileIdsMap is empty
    if (!fileId && Array.isArray(uploadedFileIds) && uploadedFileIds.length > index) {
      fileId = uploadedFileIds[index]
      console.log(`Using fallback file_id from uploadedFileIds[${index}]:`, fileId)
    }

    if (!fileId) {
      console.error('File ID lookup failed:', {
        studentName,
        index,
        fileIdsMap,
        uploadedFileIds,
        scoresLength: scores.length
      })
      setError(`File ID not found for ${studentName}. Cannot re-evaluate. The file may have been removed or the page needs to be refreshed.`)
      return
    }

    // Use current title and description from state (don't rely on lastTitle/lastDescription)
    const currentTitle = title.trim() || lastTitle
    const currentDescription = description.trim() || lastDescription

    if (!currentTitle || !currentDescription) {
      setError('Title or description not available for re-evaluation. Please ensure title and description fields are filled.')
      return
    }

    setReevaluating(prev => ({ ...prev, [index]: true }))
    setError('')

    try {
      // First, check if the endpoint is available
      const endpointAvailable = await checkReevaluateEndpoint()
      if (!endpointAvailable) {
        setError('Re-evaluate endpoint is not available. Please ensure the backend server is running on http://localhost:8000 and restart both servers.')
        setReevaluating(prev => ({ ...prev, [index]: false }))
        return
      }

      console.log('Re-evaluating:', {
        fileId,
        studentName,
        index,
        title: currentTitle,
        description: currentDescription.substring(0, 50) + '...'
      })

      // Make sure we're calling the correct endpoint
      const endpoint = '/reevaluate'
      console.log('Calling re-evaluate endpoint:', endpoint, 'with data:', {
        file_id: fileId,
        title: currentTitle.substring(0, 30) + '...',
        description: currentDescription.substring(0, 30) + '...'
      })

      const response = await api.post(endpoint, {
        file_id: fileId,
        title: currentTitle,
        description: currentDescription
      })

      console.log('Re-evaluate API response:', response.data)

      if (response.data.success && response.data.result) {
        // Update the score for this student - this is a fresh re-evaluation from scratch
        const updatedScores = [...scores]
        const newResult = response.data.result

        // Log the re-evaluation for debugging
        console.log('Re-evaluation completed - fresh evaluation from scratch:', {
          studentName,
          oldScore: student.score_percent,
          newScore: newResult.score_percent,
          detailsCount: newResult.details?.length || 0
        })

        // Update the score at the correct index
        updatedScores[index] = newResult
        setScores(updatedScores)

        // Sync with giant result string if in PPT mode to avoid "clearing" data in the reports below
        if (mode === 'ppt' && newResult.formatted_result) {
          try {
            const fileSections = splitPPTFileSections(result)
            if (fileSections.length > index) {
              fileSections[index] = newResult.formatted_result
              setResult(fileSections.join('\n\n'))
              console.log('PPT result string synchronized after re-evaluation')
            } else if (fileSections.length === 0 || (fileSections.length === 1 && fileSections[0] === '')) {
              // Fallback if result was somehow empty
              setResult(newResult.formatted_result)
            }
          } catch (syncErr) {
            console.warn('Failed to sync PPT result string:', syncErr)
          }
        }

        // Clear any previous errors
        setError('')

        // DON'T update global summary during single-student re-evaluation
        // if (response.data.summary) {
        //   setSummary(response.data.summary)
        // }
      } else {
        const errorMsg = response.data.error || `Failed to re-evaluate ${studentName}`
        console.error('Re-evaluation failed:', errorMsg, response.data)
        setError(errorMsg)
      }
    } catch (err) {
      console.error('Re-evaluation error:', err)

      // Handle 404 specifically - endpoint not found
      if (err.response?.status === 404) {
        const errorMsg = `Re-evaluate endpoint not found (404). Please ensure:\n1. Backend server is running on http://localhost:8000\n2. Vite dev server is running with proxy configured\n3. Both servers are restarted after code changes`
        setError(errorMsg)
        console.error('404 Error Details:', {
          url: err.config?.url,
          baseURL: err.config?.baseURL,
          fullURL: err.config?.baseURL + err.config?.url,
          message: err.message
        })
      } else {
        const errorMsg = err.response?.data?.error || err.response?.data?.detail || err.message || `Error re-evaluating ${studentName}`
        setError(errorMsg)
      }
    } finally {
      setReevaluating(prev => ({ ...prev, [index]: false }))
    }
  }

  return (
    <div className="min-h-screen bg-[#F0FDFB]">
      <Navbar />

      <div className="container mx-auto px-4 py-8 animate-slide-up">
        {mode === null ? (
          <div className="max-w-6xl mx-auto py-12">
            <div className="text-center mb-16 px-4">
              <h1 className="text-6xl font-black text-[#003B46] mb-6 tracking-tight uppercase leading-[0.9]">
                Select Your <span className="text-[#00A896]">Assessment  </span>
              </h1>
              <p className="text-xl text-[#003B46]/60 font-bold tracking-tight">Choose a specialized protocol to begin your AI-powered evaluation.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 px-4">
              {/* File Assessment Card */}
              <div
                onClick={() => setMode('files')}
                className="group relative bg-white border border-gray-100 p-10 rounded-[40px] shadow-sm hover:shadow-2xl hover:-translate-y-4 transition-all duration-500 cursor-pointer overflow-hidden border-b-8 border-b-[#00A896]/10 hover:border-b-[#00A896]"
              >
                <div className="absolute top-0 right-0 p-8 opacity-[0.03] group-hover:opacity-10 group-hover:scale-150 transition-all duration-700">
                  <svg className="w-40 h-40" fill="currentColor" viewBox="0 0 24 24"><path d="M14 2H6c-1.1 0-1.99.9-1.99 2L4 20c0 1.1.89 2 1.99 2H18c1.1 0 2-.9 2-2V8l-6-6zm2 16H8v-2h8v2zm0-4H8v-2h8v2zm-3-5V3.5L18.5 9H13z" /></svg>
                </div>
                <div className="w-20 h-20 bg-gradient-to-br from-[#00A896] to-[#007A7C] rounded-3xl flex items-center justify-center mb-10 shadow-xl group-hover:rotate-6 transition-transform">
                  <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                </div>
                <h3 className="text-3xl font-black text-[#003B46] mb-4 uppercase tracking-tighter">File Audit</h3>
                <p className="text-[#003B46]/60 font-bold mb-10 leading-relaxed">AI-powered evaluation for PDF, DOCX, and Text assignments.</p>
                <button className="flex items-center gap-2 text-[#00A896] font-black uppercase tracking-widest text-[10px] group-hover:gap-5 transition-all">Initialize   <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M14 5l7 7-7 7" /></svg></button>
              </div>

              {/* PPT Assessment Card */}
              <div
                onClick={() => setMode('ppt')}
                className="group relative bg-white border border-gray-100 p-10 rounded-[40px] shadow-sm hover:shadow-2xl hover:-translate-y-4 transition-all duration-500 cursor-pointer overflow-hidden border-b-8 border-b-[#0EA5E9]/10 hover:border-b-[#0EA5E9]"
              >
                <div className="absolute top-0 right-0 p-8 opacity-[0.03] group-hover:opacity-10 group-hover:scale-150 transition-all duration-700">
                  <svg className="w-40 h-40" fill="currentColor" viewBox="0 0 24 24"><path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-5 14h-2V9h-2V7h4v10z" /></svg>
                </div>
                <div className="w-20 h-20 bg-gradient-to-br from-[#0EA5E9] to-[#0284C7] rounded-3xl flex items-center justify-center mb-10 shadow-xl group-hover:rotate-6 transition-transform">
                  <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z" /></svg>
                </div>
                <h3 className="text-3xl font-black text-[#003B46] mb-4 uppercase tracking-tighter">Slide Logic</h3>
                <p className="text-[#003B46]/60 font-bold mb-10 leading-relaxed">Deep analysis of presentation content and design   metrics.</p>
                <button className="flex items-center gap-2 text-[#0EA5E9] font-black uppercase tracking-widest text-[10px] group-hover:gap-5 transition-all">Initialize   <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M14 5l7 7-7 7" /></svg></button>
              </div>

              {/* GitHub Card */}
              <div
                onClick={() => setMode('github')}
                className="group relative bg-white border border-gray-100 p-10 rounded-[40px] shadow-sm hover:shadow-2xl hover:-translate-y-4 transition-all duration-500 cursor-pointer overflow-hidden border-b-8 border-b-[#6366F1]/10 hover:border-b-[#6366F1]"
              >
                <div className="absolute top-0 right-0 p-8 opacity-[0.03] group-hover:opacity-10 group-hover:scale-150 transition-all duration-700">
                  <svg className="w-40 h-40" fill="currentColor" viewBox="0 0 24 24"><path d="M12 .3a12.1 12.1 0 00-3.8 23.4c.6.1.8-.3.8-.6v-2c-3.3.7-4-1.6-4-1.6-.6-1.4-1.4-1.8-1.4-1.8-1-.7.1-.7.1-.7 1.2.1 1.9 1.2 1.9 1.2 1 1.8 2.8 1.3 3.5 1 .1-.8.4-1.3.8-1.6-2.7-.3-5.5-1.3-5.5-6 0-1.2.5-2.3 1.3-3.1-.2-.4-.6-1.6.1-3.2 0 0 1-.3 3.3 1.2a11.5 11.5 0 016 0c2.3-1.5 3.3-1.2 3.3-1.2.7 1.6.3 2.8.1 3.2.8.8 1.3 1.9 1.3 3.1 0 4.7-2.8 5.6-5.5 6 .5.4.9 1.2.9 2.4v3.5c0 .3.2.7.8.6A12.1 12.1 0 0012 .3z" /></svg>
                </div>
                <div className="w-20 h-20 bg-gradient-to-br from-[#6366F1] to-[#4F46E5] rounded-3xl flex items-center justify-center mb-10 shadow-xl group-hover:rotate-6 transition-transform">
                  <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" /></svg>
                </div>
                <h3 className="text-3xl font-black text-[#003B46] mb-4 uppercase tracking-tighter">Repo Audit</h3>
                <p className="text-[#003B46]/60 font-bold mb-10 leading-relaxed">Comprehensive audit of codebases against architectural rules.</p>
                <button className="flex items-center gap-2 text-[#6366F1] font-black uppercase tracking-widest text-[10px] group-hover:gap-5 transition-all">Initialize   <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M14 5l7 7-7 7" /></svg></button>
              </div>
            </div>
          </div>
        ) : (
          <>
            {/* Assessment UI Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between mb-12 gap-8">
              <div className="space-y-6">
                <button
                  onClick={() => setMode(null)}
                  className="flex items-center gap-3 px-8 py-3 bg-[#003B46] text-white rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-[#00A896] transition-all group shadow-xl active:scale-95"
                >
                  <svg className="w-4 h-4 group-hover:-translate-x-2 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
                  Switch   Type
                </button>
                <h1 className="text-5xl font-black text-[#003B46] tracking-tighter uppercase leading-none">
                  Assessment <span className="text-[#00A896]">Engine</span>
                </h1>
                <p className="text-[#003B46]/60 font-bold text-lg">Hyper-accurate   evaluation. Initialize assessment protocol below.</p>
              </div>

              <div className="flex items-center gap-5 bg-white p-5 rounded-[30px] border border-gray-100 shadow-sm">
                <div className={`w-4 h-4 rounded-full animate-pulse shadow-[0_0_15px] ${mode === 'files' ? 'bg-[#00A896] shadow-[#00A896]' : mode === 'ppt' ? 'bg-[#0EA5E9] shadow-[#0EA5E9]' : 'bg-[#6366F1] shadow-[#6366F1]'}`}></div>
                <span className="text-[#003B46] font-black text-xs uppercase tracking-[3px]">
                  {mode === 'files' ? 'File Protocol Active' : mode === 'ppt' ? 'Slide Logic Active' : 'Repo Audit Active'}
                </span>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
              {/* Left Column: Data Ingestion */}
              <div className="bg-white rounded-[50px] p-12 border border-gray-100 shadow-sm relative overflow-hidden group">
                <h2 className="text-2xl font-black text-[#003B46] mb-10 uppercase tracking-tighter border-b border-gray-50 pb-6">
                  Upload Files
                </h2>

                {mode === 'files' ? (
                  <div
                    className={`border-4 border-dashed rounded-[40px] p-16 text-center transition-all ${dragActive ? 'border-[#007A7C] bg-[#00A896]/5 scale-[0.98]' : 'border-gray-100 hover:border-[#00A896]/30 hover:bg-gray-50'}`}
                    onDragEnter={handleDrag} onDragLeave={handleDrag} onDragOver={handleDrag} onDrop={handleDrop}
                  >
                    <p className="text-[#003B46] font-black uppercase text-sm tracking-widest mb-2">Drop Student Payload</p>
                    <p className="text-[#003B46]/30 text-[10px] font-black uppercase tracking-[2px] mb-10 italic">PDF • DOCX • TXT</p>
                    <input type="file" multiple accept=".pdf,.txt,.doc,.docx" onChange={handleFileInput} className="hidden" id="file-upload" />
                    <label htmlFor="file-upload" className="inline-block bg-[#003B46] text-white px-10 py-4 rounded-2xl font-black uppercase tracking-widest text-[10px] hover:bg-[#00A896] cursor-pointer transition-all shadow-xl active:scale-95">Select Clusters</label>
                  </div>
                ) : mode === 'ppt' ? (
                  <PPTUpload files={pptFiles} onFilesChange={setPptFiles} onRemoveFile={removePPTFile} formatFileSize={formatFileSize} dragActive={pptDragActive} onDragEnter={handlePPTDrag} onDragLeave={handlePPTDrag} onDragOver={handlePPTDrag} onDrop={handlePPTDrop} />
                ) : (
                  <div className="space-y-8">
                    <GitHubRepo value={githubUrl} onChange={setGithubUrl} />
                  </div>
                )}

                {/* Queue List */}
                {mode === 'files' && files.length > 0 && (
                  <div className="mt-12 space-y-6">
                    <h3 className="text-[10px] font-black text-[#00A896] uppercase tracking-[5px] mb-6">Queued  s ({files.length})</h3>
                    <div className="max-h-[300px] overflow-y-auto pr-4 space-y-4">
                      {files.map((file, index) => (
                        <div key={index} className="flex items-center justify-between p-6 bg-gray-50 rounded-3xl border border-gray-100 transition-all">
                          <div className="min-w-0"><p className="text-sm font-black text-[#003B46] truncate">{file.name}</p><p className="text-[10px] font-black text-[#003B46]/20 uppercase tracking-widest mt-1">{formatFileSize(file.size)}</p></div>
                          <button onClick={() => removeFile(index)} className="p-3 text-red-300 hover:text-red-500 rounded-2xl transition-all"><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" /></svg></button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Right Column: Logic Core */}
              <div className="bg-white rounded-[50px] p-12 border border-gray-100 shadow-sm">
                <h2 className="text-2xl font-black text-[#003B46] mb-10 uppercase tracking-tighter border-b border-gray-50 pb-6">EVALUATION DETAILS</h2>
                <div className="space-y-10">
                  <div className="space-y-3">
                    <label className="text-[10px] font-black text-[#003B46]/30 uppercase tracking-[6px] ml-1">Title  </label>
                    <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Project identifier..." className="w-full px-8 py-5 bg-gray-50 border border-gray-100 rounded-3xl focus:ring-4 focus:ring-[#00A896]/10 focus:bg-white outline-none transition font-black text-[#003B46]" />
                  </div>

                  <div className="space-y-3">
                    <label className="text-[10px] font-black text-[#003B46]/30 uppercase tracking-[6px] ml-1">Description  </label>
                    <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={7} placeholder="Processing instructions..." className="w-full px-8 py-5 bg-gray-50 border border-gray-100 rounded-3xl focus:ring-4 focus:ring-[#00A896]/10 focus:bg-white outline-none transition font-medium text-[#003B46] resize-none leading-relaxed" />

                    <div className="bg-[#003B46]/5 p-6 rounded-3xl border border-[#003B46]/10 mt-2">
                      <div className="flex gap-3 mb-2 items-center">
                        <svg className="w-4 h-4 text-[#00A896]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <span className="text-[10px] font-black text-[#003B46] uppercase tracking-widest">
                          {mode === 'files' ? 'Guidance' : mode === 'ppt' ? 'Design Logic Guide' : 'Audit Rules'}
                        </span>
                      </div>
                      <p className="text-xs font-bold text-[#003B46]/60 leading-relaxed italic whitespace-pre-wrap">
                        {mode === 'files'
                          ? "Upload student documents on the left. In this field, paste the original assignment questions, grading rubric, or specific criteria.\n• Define point systems (e.g., 'Q1=10pts')\n• Set penalties (e.g., 'Syntax error = -2pts')\n• Specify formatting rules (e.g., 'MLA style only')"
                          : mode === 'ppt'
                            ? "Upload presentation decks. Use this field to define the audience and goals.\n• 'Corporate pitch style with high contrast'\n• 'Max 6 lines of text per slide'\n• 'Readable font sizes (>24px)'\n• 'Consistent visual hierarchy'"
                            : "Enter a public GitHub URL. Define strict architectural rules here.\n• 'No console.log statements'\n• 'Components must be < 200 lines'\n• 'Enforce strict typing'\n• 'Require docstrings for all functions'\n• 'No magic numbers'"
                        }
                      </p>
                    </div>
                  </div>

                  <button
                    onClick={handleGenerate}
                    disabled={isGenerating || (mode === 'files' && (!title.trim() || !description.trim() || files.length === 0)) || (mode === 'ppt' && (!title.trim() || !description.trim() || pptFiles.length === 0)) || (mode === 'github' && (!isValidGitHubUrl(githubUrl) || !description.trim()))}
                    className="w-full h-20 bg-[#003B46] hover:bg-[#00252D] text-white rounded-[30px] font-black uppercase tracking-[5px] text-[10px] transition-all duration-500 shadow-xl disabled:opacity-30 flex items-center justify-center gap-5"
                  >
                    {isGenerating ? "Processing  ..." : "Initialize Assessment"}
                  </button>
                </div>
              </div>
            </div>

            {/* Results Layer */}
            {(result || summary || (scores && scores.length > 0) || error) && (
              <div className="mt-20 bg-white rounded-[60px] border border-gray-100 shadow-2xl p-16 overflow-hidden relative">
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-10 mb-16 border-b border-gray-50 pb-16">
                  <h2 className="text-5xl font-black text-[#003B46] uppercase leading-none tracking-tighter">Assessment <span className="text-[#00A896]">Matrix</span></h2>

                  {/* Search and Filter Unit - Hidden for GitHub mode */}
                  {mode !== 'github' && (
                    <div className="flex flex-1 max-w-2xl gap-4 items-center bg-gray-50/50 p-3 rounded-[30px] border border-gray-100 mx-0 lg:mx-10 shadow-inner">
                      <div className="relative flex-1">
                        <svg className="absolute left-5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#003B46]/30" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                        <input
                          type="text"
                          placeholder="Search   Name..."
                          value={searchTerm}
                          onChange={(e) => setSearchTerm(e.target.value)}
                          className="w-full pl-12 pr-6 py-4 bg-white rounded-2xl border border-gray-100 text-[10px] font-black uppercase tracking-widest focus:ring-4 focus:ring-[#00A896]/10 outline-none transition-all placeholder:text-gray-300"
                        />
                      </div>
                      <select
                        value={scoreFilter}
                        onChange={(e) => setScoreFilter(e.target.value)}
                        className="bg-white px-6 py-4 rounded-2xl border border-gray-100 text-[10px] font-black uppercase tracking-[2px] outline-none cursor-pointer hover:bg-gray-100 transition-all font-black text-[#003B46]"
                      >
                        <option value="all">Global Scan</option>
                        <option value="high">Above 80%</option>
                        <option value="low">Below 50%</option>
                      </select>
                    </div>
                  )}

                  {(result || summary || (scores && scores.length > 0)) && (
                    <div className="flex flex-wrap gap-3">
                      <button onClick={handleDownloadPdf} className="px-6 py-4 bg-[#003B46] text-white rounded-2xl font-black uppercase text-[10px] tracking-[3px] hover:bg-[#00A896] transition-all shadow-xl active:scale-95">Export.PDF</button>
                      <button onClick={handleDownloadDoc} className="px-6 py-4 bg-white border border-gray-100 text-[#003B46] rounded-2xl font-black uppercase text-[10px] tracking-[3px] hover:bg-gray-50 transition-all shadow-sm active:scale-95">Export.DOC</button>
                      <button onClick={handleDownloadResult} className="px-6 py-4 bg-white border border-gray-100 text-[#003B46] rounded-2xl font-black uppercase text-[10px] tracking-[3px] hover:bg-gray-50 transition-all shadow-sm active:scale-95">Export.TXT</button>
                      {mode !== 'github' && (
                        <button onClick={handleDownloadExcel} className="px-6 py-4 bg-[#00A896]/10 text-[#00A896] rounded-2xl font-black uppercase text-[10px] tracking-[3px] hover:bg-[#00A896] hover:text-white transition-all active:scale-95">Export.XLSX</button>
                      )}
                    </div>
                  )}
                </div>

                {error && <div className="bg-red-50 text-red-600 p-10 rounded-[40px] mb-16 font-black italic border border-red-100">{error}</div>}

                <div className="space-y-20 font-black tracking-tight">
                  {summary && (
                    <div className="bg-[#003B46] text-white p-14 rounded-[50px] shadow-2xl">
                      <h3 className="text-[10px] font-black uppercase tracking-[10px] mb-8 text-[#00A896]">Summary  </h3>
                      <p className="text-xl font-medium leading-loose opacity-90 whitespace-pre-wrap">{summary}</p>
                    </div>
                  )}

                  {scores && scores.length > 0 && (
                    <div className="space-y-12">
                      <h3 className="text-[10px] font-black text-[#003B46]/30 uppercase tracking-[10px] mb-10 border-l-[10px] border-[#00A896] pl-8">
                        Active Cluster Metrics ({
                          scores.filter(s => {
                            const nameMatch = (s.name || '').toLowerCase().includes(searchTerm.toLowerCase())
                            const score = typeof s.score_percent === 'number' ? s.score_percent : parseFloat(s.score_percent)
                            const scoreMatch = scoreFilter === 'all' ? true : scoreFilter === 'high' ? score > 80 : score < 50
                            return nameMatch && scoreMatch
                          }).length
                        })
                      </h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                        {scores
                          .filter(s => {
                            const nameMatch = (s.name || '').toLowerCase().includes(searchTerm.toLowerCase())
                            const score = typeof s.score_percent === 'number' ? s.score_percent : parseFloat(s.score_percent)
                            const scoreMatch = scoreFilter === 'all' ? true : scoreFilter === 'high' ? score > 80 : score < 50
                            return nameMatch && scoreMatch
                          })
                          .map((s, idx) => (
                            <div key={idx} className="bg-gray-50 border border-gray-100 p-12 rounded-[50px] hover:bg-white hover:shadow-2xl transition-all duration-500 group">
                              <div className="flex justify-between items-start mb-10 border-b border-gray-50 pb-10">
                                <div className="space-y-2">
                                  <h4 className="text-3xl font-black text-[#003B46] tracking-tighter uppercase">{s.name || `  ${idx + 1}`}</h4>
                                </div>
                                <div className="text-7xl font-black text-[#003B46] tracking-[-8px] opacity-10 group-hover:opacity-100 group-hover:text-[#00A896] transition-all duration-500">
                                  {typeof s.score_percent === 'number' ? s.score_percent.toFixed(0) : s.score_percent}
                                </div>
                              </div>
                              <p className="text-[#003B46]/50 font-bold text-sm mb-12 line-clamp-4 leading-relaxed italic">"{s.reasoning}"</p>
                              <div className="flex flex-col gap-4">
                                <div className="flex gap-2">
                                  <button onClick={() => handleDownloadStudentPdf(s, idx)} className="flex-1 py-3 bg-white text-[#003B46] rounded-xl text-[9px] font-black uppercase border border-gray-100 hover:bg-[#003B46] hover:text-white transition-all shadow-sm">Report.PDF</button>
                                  <button onClick={() => handleDownloadStudentDoc(s, idx)} className="px-4 py-3 bg-white text-[#003B46] rounded-xl text-[9px] font-black uppercase border border-gray-100 hover:bg-[#003B46] hover:text-white transition-all shadow-sm">DOC</button>
                                  <button onClick={() => handleDownloadStudentTxt(s, idx)} className="px-4 py-3 bg-white text-[#003B46] rounded-xl text-[9px] font-black uppercase border border-gray-100 hover:bg-[#003B46] hover:text-white transition-all shadow-sm">TXT</button>
                                </div>
                                <button onClick={() => handleReevaluate(s, idx)} disabled={reevaluating[idx]} className="w-full py-4 bg-[#003B46] text-white rounded-2xl text-[10px] font-black uppercase tracking-[3px] hover:bg-[#00A896] transition-all shadow-md active:scale-95 disabled:opacity-20 flex items-center justify-center gap-2">
                                  {reevaluating[idx] ? <><svg className="animate-spin h-3 w-3" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" /></svg> Syncing...</> : 'Re-Sync  '}
                                </button>
                              </div>
                            </div>
                          ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}

export default Services
