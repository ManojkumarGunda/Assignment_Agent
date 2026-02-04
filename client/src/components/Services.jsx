import { useState, useEffect } from 'react'
import { Snackbar, Alert, Dialog, DialogTitle, DialogContent, DialogActions, Button, IconButton } from '@mui/material'
import CloseIcon from '@mui/icons-material/Close'
import TheoryIcon from '@mui/icons-material/MenuBook'
import CodeIcon from '@mui/icons-material/Code'
import GeneralIcon from '@mui/icons-material/Settings'
import MathIcon from '@mui/icons-material/Functions'
import ArrowIcon from '@mui/icons-material/KeyboardArrowDown'
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
  const [refFiles, setRefFiles] = useState([]) // New: Reference files state
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
  const [uploadedRefFileIds, setUploadedRefFileIds] = useState([]) // New: Uploaded reference IDs
  const [fileIdsMap, setFileIdsMap] = useState({}) // Map student name to file_id for re-evaluation
  const [lastDescription, setLastDescription] = useState('') // Store description for re-evaluation
  const [geminiStatus, setGeminiStatus] = useState(null)
  const [lastTitle, setLastTitle] = useState('')
  const [githubUrl, setGithubUrl] = useState('')
  const [mode, setMode] = useState(null) // null | 'files' | 'github' | 'ppt'
  const [evaluateDesign, setEvaluateDesign] = useState(false) // For PPT: evaluate design vs content
  const [reevaluating, setReevaluating] = useState({}) // Track which student is being re-evaluated
  const [toast, setToast] = useState({ open: false, message: '', severity: 'error' })
  const [searchTerm, setSearchTerm] = useState('')
  const [scoreFilter, setScoreFilter] = useState('all') // 'all' | 'high' | 'mid' | 'low'
  const [selectedStudent, setSelectedStudent] = useState(null)
  const [category, setCategory] = useState('theory') // 'theory' | 'coding' | 'general'
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const [subject, setSubject] = useState('none')
  const [subjectDropdownOpen, setSubjectDropdownOpen] = useState(false)
  const [manualOverrides, setManualOverrides] = useState({}) // { detail_id: { manual_score, teacher_note } }
  const [isSavingOverride, setIsSavingOverride] = useState(false)

  const theorySubjects = [
    { id: 'none', label: 'General Theory' },
    { id: 'physics', label: 'Physics' },
    { id: 'biology', label: 'Biology' },
    { id: 'geography', label: 'Geography' },
    { id: 'chemistry', label: 'Chemistry' },
    { id: 'history', label: 'History' },
    { id: 'economics', label: 'Economics' },
    { id: 'civics', label: 'Civics' },
  ]

  const handleToastClose = (event, reason) => {
    if (reason === 'clickaway') return
    setToast(prev => ({ ...prev, open: false }))
  }


  const handleFiles = (selectedFiles) => {
    const acceptedExtensions = ['.pdf', '.txt', '.doc', '.docx']
    const fileArray = Array.from(selectedFiles)
    const validFiles = []
    let hasInvalid = false
    let tooLarge = false
    const MAX_SIZE = 30 * 1024 * 1024 // 30MB

    fileArray.forEach(f => {
      const ext = f.name.toLowerCase().substring(f.name.lastIndexOf('.'))
      if (f.size > MAX_SIZE) {
        tooLarge = true
      } else if (acceptedExtensions.includes(ext)) {
        validFiles.push(f)
      } else {
        hasInvalid = true
      }
    })

    if (tooLarge) {
      setToast({ open: true, message: 'File size exceeds 30MB limit.', severity: 'error' })
    }

    if (hasInvalid) {
      setToast({ open: true, message: 'Invalid file! Only PDF, Text, DOC, and DOCX files are allowed.', severity: 'error' })
    }

    return validFiles
  }

  const handleStudentFiles = (selectedFiles) => {
    const validFiles = handleFiles(selectedFiles)
    if (validFiles.length > 0) {
      setFiles(prev => [...prev, ...validFiles])
    }
  }

  const handleRefFiles = (selectedFiles) => {
    const validFiles = handleFiles(selectedFiles)
    if (validFiles.length > 0) {
      setRefFiles(prev => [...prev, ...validFiles])
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
      handleStudentFiles(e.dataTransfer.files)
    }
  }

  const handleFileInput = (e) => {
    if (e.target.files && e.target.files[0]) {
      handleStudentFiles(e.target.files)
    }
  }

  const handleRefInput = (e) => {
    if (e.target.files && e.target.files[0]) {
      handleRefFiles(e.target.files)
    }
  }

  const removeFile = (index) => {
    setFiles(prev => prev.filter((_, i) => i !== index))
  }

  const removeRefFile = (index) => {
    setRefFiles(prev => prev.filter((_, i) => i !== index))
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
    // Check Gemini AI status on component mount
    checkGeminiStatus()
    // Check if re-evaluate endpoint is available
    checkReevaluateEndpoint()
  }, [])

  useEffect(() => {
    if (error) {
      setToast({ open: true, message: error, severity: 'error' })
    }
  }, [error])

  const checkGeminiStatus = async () => {
    try {
      const response = await api.get('/system/gemini/status')
      setGeminiStatus(response.data)
    } catch (err) {
      setGeminiStatus({ connected: false })
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
      if (files.length === 0) {
        setError('Please upload at least one file')
        return
      }
    } else if (mode === 'ppt') {
      if (!title.trim()) {
        setError('Please enter a title')
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
      }

      // Step 1.5: Upload Reference Files (separate batch)
      let refFileIds = []
      if (refFiles.length > 0) {
        const formData = new FormData()
        refFiles.forEach(file => {
          formData.append('files', file)
        })
        const uploadRefResponse = await api.post('/files/upload', formData)
        if (uploadRefResponse.data.success) {
          refFileIds = uploadRefResponse.data.file_ids
          setUploadedRefFileIds(refFileIds)
          console.log("Reference files uploaded:", refFileIds)
        }
      }

      if (mode === 'ppt') {
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

      const categoryPrompt = category === 'coding'
        ? "Evaluate logic, syntax, and algorithmic efficiency."
        : category === 'theory'
          ? `Focus on conceptual clarity, depth, and keyword accuracy for ${subject !== 'none' ? subject.toUpperCase() : 'Theory'}.`
          : category === 'maths'
            ? "Evaluate based on strict mathematical correctness, step-by-step logic, and final answer accuracy. Use LaTeX for math expressions."
            : "Evaluate based on general assessment standards.";

      const subjectLabel = subject !== 'none' ? `[SUBJECT: ${subject.toUpperCase()}] ` : "";
      const usedDescription = description.trim()
        ? `[CATEGORY: ${category.toUpperCase()}] ${subjectLabel}${description.trim()}`
        : `Please perform a comprehensive ${category.toUpperCase()} assessment ${subject !== 'none' ? 'for ' + subject.toUpperCase() : ''}. ${categoryPrompt}`;

      // Step 2: Generate content or evaluate/grade GitHub repo
      let response
      if (mode === 'github') {
        // Use GitHub grading endpoint - evaluates repo against user rules/description
        try {
          response = await api.post('/github/grade', {
            github_url: githubUrl.trim(),
            description: usedDescription,
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

          const chatResponse = gradingData.conversational_response || gradingData.overall_comment || "Analysis complete."
          const techStack = Array.isArray(gradingData.detected_technology_stack) ? gradingData.detected_technology_stack.join(', ') : 'Not detected'

          const cleanSummary = [
            `RESPONSE TO YOUR QUERY:\n${chatResponse}`,
            `\nDETECTED STACK: ${techStack}`,
            `\n---\nDETAILED ANALYSIS LOG:\n${gradingData.rules_summary || 'No further details.'}`
          ].join('\n')

          setResult(cleanSummary)
          setSummary(cleanSummary)
          setScores([{
            name: "Repository Analysis",
            // Use -1 or null to signal UI to hide score circle if we want, or just 0
            score_percent: null,
            reasoning: chatResponse,
            details: []
          }])
        } else {
          setError(response.data.error || 'GitHub grading failed')
        }
      } else {
        response = await api.post('/files/generate', {
          title: title.trim(),
          description: usedDescription,
          file_ids: fileIds,
          reference_file_ids: refFileIds, // Pass reference IDs
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
          setLastDescription(usedDescription)
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

  const handleOverrideChange = (detailId, field, value) => {
    setManualOverrides(prev => ({
      ...prev,
      [detailId]: {
        ...(prev[detailId] || { manual_score: null, teacher_note: '' }),
        [field]: value
      }
    }))
  }

  const handleSaveOverrides = async () => {
    if (!selectedStudent || !selectedStudent.id) {
      setToast({ open: true, message: 'Invalid student record. Refresh and try again.', severity: 'error' })
      return
    }

    const payload = {
      result_id: selectedStudent.id,
      overall_note: selectedStudent.teacher_note,
      details: Object.entries(manualOverrides).map(([detailId, data]) => ({
        detail_id: parseInt(detailId),
        manual_score: data.manual_score !== undefined ? data.manual_score : (selectedStudent.details.find(d => d.id === parseInt(detailId))?.score || 0),
        teacher_note: data.teacher_note !== undefined ? data.teacher_note : (selectedStudent.details.find(d => d.id === parseInt(detailId))?.teacher_note || '')
      }))
    }

    if (payload.details.length === 0) {
      setToast({ open: true, message: 'No changes to save.', severity: 'info' })
      return
    }

    setIsSavingOverride(true)
    try {
      const response = await api.post('/override/save', payload)
      if (response.data.success) {
        // Update local state to reflect new scores
        const updatedScores = scores.map(s => {
          if (s.id === selectedStudent.id) {
            const updatedDetails = s.details.map(d => {
              const override = manualOverrides[d.id]
              if (override) {
                return {
                  ...d,
                  score: override.manual_score !== undefined ? override.manual_score : d.score,
                  teacher_note: override.teacher_note !== undefined ? override.teacher_note : d.teacher_note,
                  is_overridden: true,
                  is_correct: (override.manual_score !== undefined ? override.manual_score : d.score) >= 0.8
                }
              }
              return d
            })
            return {
              ...s,
              score_percent: response.data.new_score,
              details: updatedDetails,
              is_overridden: true
            }
          }
          return s
        })
        setScores(updatedScores)

        // Update selectedStudent modal data too
        const updatedStudent = updatedScores.find(s => s.id === selectedStudent.id)
        setSelectedStudent(updatedStudent)

        setManualOverrides({})
        setToast({ open: true, message: 'Manual overrides saved successfully!', severity: 'success' })
      }
    } catch (err) {
      console.error('Save override error:', err)
      setToast({ open: true, message: 'Failed to save overrides. ' + (err.response?.data?.detail || err.message), severity: 'error' })
    } finally {
      setIsSavingOverride(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#F0FDFB]">
      <Navbar />

      <div className="container mx-auto px-4 py-8 animate-slide-up">
        {mode === null ? (
          <div className="max-w-6xl mx-auto py-6 md:py-12">
            <div className="text-center mb-10 md:mb-16 px-4">
              <h1 className="text-3xl sm:text-4xl md:text-6xl font-black text-[#003B46] mb-4 md:mb-6 tracking-tight uppercase leading-tight md:leading-[0.9]">
                Select Your <span className="text-[#00A896]">Assessment</span>
              </h1>
              <p className="text-sm md:text-xl text-[#003B46]/60 font-bold tracking-tight px-4">Choose a specialized protocol to begin your AI-powered evaluation.</p>
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
                className="group relative bg-white border border-gray-100 p-6 md:p-10 rounded-[40px] shadow-sm hover:shadow-2xl hover:-translate-y-2 transition-all duration-500 cursor-pointer overflow-hidden border-b-8 border-b-[#0EA5E9]/10 hover:border-b-[#0EA5E9]"
              >
                <div className="absolute top-0 right-0 p-4 md:p-8 opacity-[0.03] group-hover:opacity-10 group-hover:scale-150 transition-all duration-700">
                  <svg className="w-24 h-24 md:w-40 md:h-40" fill="currentColor" viewBox="0 0 24 24"><path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-5 14h-2V9h-2V7h4v10z" /></svg>
                </div>
                <div className="w-16 h-16 md:w-20 md:h-20 bg-gradient-to-br from-[#0EA5E9] to-[#0284C7] rounded-2xl md:rounded-3xl flex items-center justify-center mb-6 md:mb-10 shadow-xl group-hover:rotate-6 transition-transform">
                  <svg className="w-8 h-8 md:w-10 md:h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z" /></svg>
                </div>
                <h3 className="text-2xl md:text-3xl font-black text-[#003B46] mb-4 uppercase tracking-tighter">Slide Logic</h3>
                <p className="text-[#003B46]/60 font-bold mb-8 md:mb-10 leading-relaxed text-sm md:text-base">Deep analysis of presentation content and design metrics.</p>
                <button className="flex items-center gap-2 text-[#0EA5E9] font-black uppercase tracking-widest text-[9px] md:text-[10px] group-hover:gap-4 transition-all">Initialize   <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M14 5l7 7-7 7" /></svg></button>
              </div>

              {/* GitHub Card */}
              <div
                onClick={() => setMode('github')}
                className="group relative bg-white border border-gray-100 p-6 md:p-10 rounded-[40px] shadow-sm hover:shadow-2xl hover:-translate-y-2 transition-all duration-500 cursor-pointer overflow-hidden border-b-8 border-b-[#6366F1]/10 hover:border-b-[#6366F1]"
              >
                <div className="absolute top-0 right-0 p-4 md:p-8 opacity-[0.03] group-hover:opacity-10 group-hover:scale-150 transition-all duration-700">
                  <svg className="w-24 h-24 md:w-40 md:h-40" fill="currentColor" viewBox="0 0 24 24"><path d="M12 .3a12.1 12.1 0 00-3.8 23.4c.6.1.8-.3.8-.6v-2c-3.3.7-4-1.6-4-1.6-.6-1.4-1.4-1.8-1.4-1.8-1-.7.1-.7.1-.7 1.2.1 1.9 1.2 1.9 1.2 1 1.8 2.8 1.3 3.5 1 .1-.8.4-1.3.8-1.6-2.7-.3-5.5-1.3-5.5-6 0-1.2.5-2.3 1.3-3.1-.2-.4-.6-1.6.1-3.2 0 0 1-.3 3.3 1.2a11.5 11.5 0 016 0c2.3-1.5 3.3-1.2 3.3-1.2.7 1.6.3 2.8.1 3.2.8.8 1.3 1.9 1.3 3.1 0 4.7-2.8 5.6-5.5 6 .5.4.9 1.2.9 2.4v3.5c0 .3.2.7.8.6A12.1 12.1 0 0012 .3z" /></svg>
                </div>
                <div className="w-16 h-16 md:w-20 md:h-20 bg-gradient-to-br from-[#6366F1] to-[#4F46E5] rounded-2xl md:rounded-3xl flex items-center justify-center mb-6 md:mb-10 shadow-xl group-hover:rotate-6 transition-transform">
                  <svg className="w-8 h-8 md:w-10 md:h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" /></svg>
                </div>
                <h3 className="text-2xl md:text-3xl font-black text-[#003B46] mb-4 uppercase tracking-tighter">Repo Audit</h3>
                <p className="text-[#003B46]/60 font-bold mb-8 md:mb-10 leading-relaxed text-sm md:text-base">Comprehensive audit of codebases against architectural rules.</p>
                <button className="flex items-center gap-2 text-[#6366F1] font-black uppercase tracking-widest text-[9px] md:text-[10px] group-hover:gap-4 transition-all">Initialize   <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M14 5l7 7-7 7" /></svg></button>
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
                <h1 className="text-3xl sm:text-4xl md:text-5xl font-black text-[#003B46] tracking-tighter uppercase leading-none">
                  Assessment <span className="text-[#00A896]">Engine</span>
                </h1>
                <p className="text-[#003B46]/60 font-bold text-sm md:text-lg">Hyper-accurate evaluation. Initialize assessment protocol below.</p>
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
              <div className="bg-white rounded-[40px] md:rounded-[50px] p-6 md:p-12 border border-gray-100 shadow-sm relative overflow-hidden group">
                <h2 className="text-xl md:text-2xl font-black text-[#003B46] mb-8 md:mb-10 uppercase tracking-tighter border-b border-gray-50 pb-6 text-center md:text-left">
                  Upload Files
                </h2>

                {mode === 'files' ? (
                  <div
                    className={`border-4 border-dashed rounded-[40px] p-8 md:p-16 text-center transition-all ${dragActive ? 'border-[#007A7C] bg-[#00A896]/5 scale-[0.98]' : 'border-gray-100 hover:border-[#00A896]/30 hover:bg-gray-50'}`}
                    onDragEnter={handleDrag} onDragLeave={handleDrag} onDragOver={handleDrag} onDrop={handleDrop}
                  >
                    <p className="text-[#003B46] font-black uppercase text-xs md:text-sm tracking-widest mb-2">Drop The Student Files</p>
                    <p className="text-[#003B46]/30 text-[9px] md:text-[10px] font-black uppercase tracking-[2px] mb-8 md:mb-10 italic">PDF • DOCX • TXT</p>
                    <input type="file" multiple accept=".pdf,.txt,.doc,.docx" onChange={handleFileInput} className="hidden" id="file-upload" />
                    <label htmlFor="file-upload" className="inline-block bg-[#003B46] text-white px-8 md:px-10 py-3 md:py-4 rounded-2xl font-black uppercase tracking-widest text-[9px] md:text-[10px] hover:bg-[#00A896] cursor-pointer transition-all shadow-xl active:scale-95">Select Files</label>
                  </div>
                ) : mode === 'ppt' ? (
                  <PPTUpload
                    files={pptFiles}
                    onFilesChange={setPptFiles}
                    onRemoveFile={removePPTFile}
                    formatFileSize={formatFileSize}
                    dragActive={pptDragActive}
                    onDragEnter={handlePPTDrag}
                    onDragLeave={handlePPTDrag}
                    onDragOver={handlePPTDrag}
                    onDrop={handlePPTDrop}
                    onError={(msg) => setToast({ open: true, message: msg, severity: 'error' })}
                  />
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
              <div className="bg-white rounded-[40px] md:rounded-[50px] p-6 md:p-12 border border-gray-100 shadow-sm">
                <h2 className="text-xl md:text-2xl font-black text-[#003B46] mb-8 md:mb-10 uppercase tracking-tighter border-b border-gray-50 pb-6 text-center md:text-left">EVALUATION DETAILS</h2>
                <div className="space-y-6 md:space-y-10">
                  {mode === 'files' && (
                    <div className="space-y-2 md:space-y-3">
                      <label className="text-[10px] md:text-[12px] font-black text-[#00A896] uppercase tracking-[4px] md:tracking-[6px] ml-1">Assessment Category</label>
                      <div className="relative">
                        <div
                          onClick={() => setDropdownOpen(!dropdownOpen)}
                          className={`w-full px-8 py-5 bg-white border-2 rounded-[25px] flex items-center justify-between cursor-pointer transition-all duration-300 ${dropdownOpen ? 'border-[#00A896] ring-4 ring-[#00A896]/10' : 'border-[#003B46]/10 hover:border-[#003B46]/30'
                            }`}
                        >
                          <div className="flex items-center gap-4">
                            {category === 'theory' && <TheoryIcon className="text-[#00A896]" />}
                            {category === 'coding' && <CodeIcon className="text-[#00A896]" />}
                            {category === 'maths' && <MathIcon className="text-[#00A896]" />}
                            {category === 'general' && <GeneralIcon className="text-[#00A896]" />}
                            <span className="font-black text-[#003B46] uppercase text-sm tracking-widest">
                              {category === 'theory' ? 'Theory' : category === 'coding' ? 'Coding Audit' : category === 'maths' ? 'Maths Protocol' : 'General Assessment'}
                            </span>
                          </div>
                          <ArrowIcon className={`transition-transform duration-300 ${dropdownOpen ? 'rotate-180' : ''} text-[#00A896]`} />
                        </div>

                        {dropdownOpen && (
                          <div className="absolute top-full left-0 right-0 mt-3 bg-white border-2 border-[#003B46]/10 rounded-[30px] shadow-2xl z-50 overflow-hidden animate-slide-in">
                            {[
                              { id: 'theory', label: 'Theory Protocol', icon: TheoryIcon },
                              { id: 'coding', label: 'Coding Audit', icon: CodeIcon },
                              { id: 'maths', label: 'Maths Protocol', icon: MathIcon },
                              { id: 'general', label: 'General Assessment', icon: GeneralIcon }
                            ].map((item) => (
                              <div
                                key={item.id}
                                onClick={() => {
                                  setCategory(item.id)
                                  setDropdownOpen(false)
                                }}
                                className={`px-8 py-5 flex items-center gap-4 cursor-pointer transition-all hover:bg-[#003B46]/5 ${category === item.id ? 'bg-[#00A896]/5 text-[#00A896]' : 'text-[#003B46]/60'
                                  }`}
                              >
                                <item.icon className={category === item.id ? 'text-[#00A896]' : 'text-[#003B46]/30'} />
                                <span className="font-black uppercase text-sm tracking-widest">{item.label}</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {mode === 'files' && category === 'theory' && (
                    <div className="space-y-2 md:space-y-3 animate-slide-up">
                      <label className="text-[10px] md:text-[12px] font-black text-[#00A896] uppercase tracking-[4px] md:tracking-[6px] ml-1">Select Subject</label>
                      <div className="relative">
                        <div
                          onClick={() => setSubjectDropdownOpen(!subjectDropdownOpen)}
                          className={`w-full px-8 py-5 bg-white border-2 rounded-[25px] flex items-center justify-between cursor-pointer transition-all duration-300 ${subjectDropdownOpen ? 'border-[#00A896] ring-4 ring-[#00A896]/10' : 'border-[#003B46]/10 hover:border-[#003B46]/30'
                            }`}
                        >
                          <div className="flex items-center gap-4">
                            <TheoryIcon className="text-[#00A896]" />
                            <span className="font-black text-[#003B46] uppercase text-sm tracking-widest">
                              {theorySubjects.find(s => s.id === subject)?.label || 'General Theory'}
                            </span>
                          </div>
                          <ArrowIcon className={`transition-transform duration-300 ${subjectDropdownOpen ? 'rotate-180' : ''} text-[#00A896]`} />
                        </div>

                        {subjectDropdownOpen && (
                          <div className="absolute top-full left-0 right-0 mt-3 bg-white border-2 border-[#003B46]/10 rounded-[30px] shadow-2xl z-50 max-h-60 overflow-y-auto animate-slide-in">
                            {theorySubjects.map((item) => (
                              <div
                                key={item.id}
                                onClick={() => {
                                  setSubject(item.id)
                                  setSubjectDropdownOpen(false)
                                }}
                                className={`px-8 py-4 flex items-center gap-4 cursor-pointer transition-all hover:bg-[#003B46]/5 ${subject === item.id ? 'bg-[#00A896]/5 text-[#00A896]' : 'text-[#003B46]/60'
                                  }`}
                              >
                                <span className="font-black uppercase text-sm tracking-widest">{item.label}</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  <div className="space-y-3">
                    <label className="text-[10px] font-black text-[#00A896] uppercase tracking-[6px] ml-1">Title  </label>
                    <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Project identifier..." className="w-full px-8 py-5 bg-gray-50 border border-gray-100 rounded-3xl focus:ring-4 focus:ring-[#00A896]/10 focus:bg-white outline-none transition font-black text-[#003B46]" />
                  </div>

                  {/* Reference Document Upload Section */}
                  {mode === 'files' && (
                    <div className="space-y-3">
                      <label className="text-[10px] font-black text-[#00A896] uppercase tracking-[6px] ml-1">Reference Material (Optional)</label>
                      <div className="border-2 border-dashed border-gray-200 rounded-[25px] p-6 text-center hover:border-[#00A896]/30 hover:bg-[#00A896]/5 transition-all">
                        <input type="file" multiple accept=".pdf,.txt,.doc,.docx" onChange={handleRefInput} className="hidden" id="ref-upload" />
                        <label htmlFor="ref-upload" className="cursor-pointer block w-full h-full">
                          <div className="flex flex-col items-center justify-center gap-2">
                            <svg className="w-8 h-8 text-[#00A896]/40" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                            <p className="text-[#003B46] font-bold text-xs uppercase tracking-widest">
                              {refFiles.length > 0 ? `${refFiles.length} Reference File(s) Selected` : "Upload Answer Key / Rubric"}
                            </p>
                          </div>
                        </label>
                        {refFiles.length > 0 && (
                          <div className="mt-4 space-y-2">
                            {refFiles.map((file, i) => (
                              <div key={i} className="flex items-center justify-between text-left bg-white p-2 px-4 rounded-xl border border-gray-100">
                                <span className="text-[10px] font-bold text-[#003B46] truncate max-w-[150px]">{file.name}</span>
                                <button onClick={(e) => { e.preventDefault(); removeRefFile(i) }} className="text-red-400 hover:text-red-600"><CloseIcon fontSize="small" /></button>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  <div className="space-y-3">
                    <div className="flex justify-between items-end">
                      <label className="text-[10px] font-black text-[#00A896] uppercase tracking-[6px] ml-1">Description {(mode === 'ppt' || mode === 'github') && '(Required)'}</label>
                      <div className="flex flex-wrap gap-2 mb-3">
                        {[
                          { label: '+ Concept', text: 'Focus on conceptual depth, clarity, and keyword accuracy.', cat: 'theory' },
                          { label: '+ Grammar', text: 'Strictly check for spelling, grammar, and professional tone.', cat: 'theory' },
                          { label: '+ Syntax', text: 'Check for naming conventions, best practices, and clean code.', cat: 'coding' },
                          { label: '+ Logic', text: 'Evaluate algorithmic efficiency and logical flow.', cat: 'coding' },
                          { label: '+ Tone', text: 'Assess the writing style for professionalism, empathy, and audience alignment.', cat: 'general' },
                          { label: '+ Fact Check', text: 'Verify the accuracy of names, dates, and core factual statements.', cat: 'general' },
                          { label: '+ Structure', text: 'Assess slide hierarchy, logical flow, and content organization.', cat: 'ppt' },
                          { label: '+ Visuals', text: 'Evaluate typography, color harmony, and layout balance.', cat: 'ppt' },
                          { label: '+ Impact', text: 'Check if key points are persuasive and meet target audience goals.', cat: 'ppt' },
                          { label: '+ Clean Code', text: 'Enforce strict coding standards. No console.log, magic numbers, or commented-out code.', cat: 'github' },
                          { label: '+ Security', text: 'Scan for hardcoded API keys, secrets, or common security vulnerabilities (XSS, Injection).', cat: 'github' },
                          { label: '+ Optimization', text: 'Identify performance bottlenecks and suggest more efficient idiomatic patterns.', cat: 'github' },
                          { label: '+ Scale', text: 'Grade out of 100. Provide 10pts per correct primary answer.', cat: 'general' },
                          { label: '+ Formatting', text: 'Ensure the document follows standard academic or technical structure.', cat: 'general' },
                          { label: '+ Formula', text: 'Verify mathematical accuracy and latex formatting.', cat: 'maths' },
                          { label: '+ Derivation', text: 'Ensure step-by-step derivation is completely shown.', cat: 'maths' }
                        ].filter(t => {
                          if (mode === 'ppt') return t.cat === 'ppt'
                          if (mode === 'github') return t.cat === 'github'
                          // For files mode:
                          if (category === 'general') return t.cat === 'theory' || t.cat === 'coding' || t.cat === 'general'
                          return t.cat === category || t.cat === 'general'
                        }).map((tmp, i) => (
                          <button
                            key={i}
                            onClick={() => setDescription(prev => prev ? prev + '\n' + tmp.text : tmp.text)}
                            className="px-3 md:px-4 py-2 bg-[#00A896] text-white rounded-xl text-[8px] md:text-[9px] font-black uppercase tracking-wider hover:bg-[#003B46] hover:scale-105 transition-all shadow-md shadow-[#00A896]/20 whitespace-nowrap"
                          >
                            {tmp.label}
                          </button>
                        ))}
                      </div>
                    </div>
                    <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={7} placeholder="Processing instructions..." className="w-full px-8 py-5 bg-gray-50 border-2 border-gray-100 rounded-3xl focus:ring-4 focus:ring-[#00A896]/10 focus:bg-white focus:border-[#00A896]/30 outline-none transition font-medium text-[#003B46] resize-none leading-relaxed" />

                    <div className="bg-[#00A896]/10 p-6 rounded-3xl border-2 border-[#00A896]/20 mt-2">
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
                    disabled={isGenerating || (mode === 'files' && (!title.trim() || files.length === 0)) || (mode === 'ppt' && (!title.trim() || !description.trim() || pptFiles.length === 0)) || (mode === 'github' && (!isValidGitHubUrl(githubUrl) || !description.trim()))}
                    className="w-full h-20 bg-gradient-to-r from-[#003B46] to-[#00A896] hover:from-[#00252D] hover:to-[#008F80] text-white rounded-[30px] font-black uppercase tracking-[5px] text-[12px] transition-all duration-500 shadow-2xl shadow-[#00A896]/30 disabled:opacity-30 disabled:shadow-none flex items-center justify-center gap-5 hover:scale-[1.02] active:scale-95"
                  >
                    {isGenerating ? "Processing Audit..." : "Evaulate Assignments"}
                  </button>
                </div>
              </div>
            </div>

            {/* Results Layer */}
            {(result || summary || (scores && scores.length > 0) || error) && (
              <div className="mt-10 md:mt-20 bg-white rounded-[40px] md:rounded-[60px] border border-gray-100 shadow-2xl p-6 md:p-16 overflow-hidden relative">
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-8 mb-10 md:mb-16 border-b border-gray-50 pb-8 md:pb-16">
                  <h2 className="text-3xl md:text-5xl font-black text-[#003B46] uppercase leading-none tracking-tighter text-center lg:text-left">Assessment <span className="text-[#00A896]">Matrix</span></h2>

                  {/* Search and Filter Unit - Hidden for GitHub mode */}
                  {mode !== 'github' && (
                    <div className="flex flex-col sm:flex-row flex-1 max-w-2xl gap-3 md:gap-4 items-stretch sm:items-center bg-gray-50/50 p-3 rounded-[25px] md:rounded-[30px] border border-gray-100 mx-0 lg:mx-10 shadow-inner">
                      <div className="relative flex-1">
                        <svg className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[#003B46]/30" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                        <input
                          type="text"
                          placeholder="Search   Name..."
                          value={searchTerm}
                          onChange={(e) => setSearchTerm(e.target.value)}
                          className="w-full pl-10 pr-4 py-3 bg-white rounded-xl md:rounded-2xl border border-gray-100 text-[9px] md:text-[10px] font-black uppercase tracking-widest focus:ring-4 focus:ring-[#00A896]/10 outline-none transition-all placeholder:text-gray-300"
                        />
                      </div>
                      <select
                        value={scoreFilter}
                        onChange={(e) => setScoreFilter(e.target.value)}
                        className="bg-white px-4 py-3 rounded-xl md:rounded-2xl border border-gray-100 text-[9px] md:text-[10px] font-black uppercase tracking-[2px] outline-none cursor-pointer hover:bg-gray-100 transition-all font-black text-[#003B46]"
                      >
                        <option value="all">Global Scan</option>
                        <option value="high">Above 80%</option>
                        <option value="low">Below 50%</option>
                      </select>
                    </div>
                  )}

                  {(result || summary || (scores && scores.length > 0)) && (
                    <div className="flex flex-wrap items-center justify-center gap-2 md:gap-3">
                      <button onClick={handleDownloadPdf} className="px-5 md:px-6 py-3 md:py-4 bg-[#003B46] text-white rounded-xl md:rounded-2xl font-black uppercase text-[9px] md:text-[10px] tracking-widest hover:bg-[#00A896] transition-all shadow-xl active:scale-95">Export.PDF</button>
                      <button onClick={handleDownloadDoc} className="px-5 md:px-6 py-3 md:py-4 bg-white border border-gray-100 text-[#003B46] rounded-xl md:rounded-2xl font-black uppercase text-[9px] md:text-[10px] tracking-widest hover:bg-gray-50 transition-all shadow-sm active:scale-95 text-center">Export.DOC</button>
                      <button onClick={handleDownloadResult} className="px-5 md:px-6 py-3 md:py-4 bg-white border border-gray-100 text-[#003B46] rounded-xl md:rounded-2xl font-black uppercase text-[9px] md:text-[10px] tracking-widest hover:bg-gray-50 transition-all shadow-sm active:scale-95 text-center">Export.TXT</button>
                      {mode !== 'github' && (
                        <button onClick={handleDownloadExcel} className="px-5 md:px-6 py-3 md:py-4 bg-[#00A896]/10 text-[#00A896] rounded-xl md:rounded-2xl font-black uppercase text-[9px] md:text-[10px] tracking-widest hover:bg-[#00A896] hover:text-white transition-all active:scale-95 text-center">Export.XLSX</button>
                      )}
                    </div>
                  )}
                </div>

                <div className="space-y-20 font-black tracking-tight">
                  {summary && (
                    <div className="bg-[#003B46] text-white p-8 md:p-14 rounded-[35px] md:rounded-[50px] shadow-2xl">
                      <h3 className="text-[9px] md:text-[10px] font-black uppercase tracking-[8px] md:tracking-[10px] mb-6 md:mb-8 text-[#00A896]">Summary</h3>
                      <p className="text-base md:text-xl font-medium leading-relaxed md:leading-loose opacity-90 whitespace-pre-wrap">{summary}</p>
                    </div>
                  )}

                  {scores && scores.length > 0 && (
                    <div className="space-y-8 md:space-y-12">
                      <h3 className="text-[9px] md:text-[10px] font-black text-[#003B46]/30 uppercase tracking-[6px] md:tracking-[10px] mb-6 md:mb-10 border-l-[6px] md:border-l-[10px] border-[#00A896] pl-5 md:pl-8">
                        Active Cluster Metrics ({
                          scores.filter(s => {
                            const nameMatch = (s.name || '').toLowerCase().includes(searchTerm.toLowerCase())
                            const score = typeof s.score_percent === 'number' ? s.score_percent : parseFloat(s.score_percent)
                            const scoreMatch = scoreFilter === 'all' ? true : scoreFilter === 'high' ? score > 80 : score < 50
                            return nameMatch && scoreMatch
                          }).length
                        })
                      </h3>
                      <div className="overflow-x-auto -mx-10 px-10">
                        <table className="w-full border-separate border-spacing-y-4">
                          <thead>
                            <tr className="text-[#003B46]/30 text-[10px] font-black uppercase tracking-[4px]">
                              <th className="px-8 py-4 text-left">SN</th>
                              <th className="px-8 py-4 text-left">Student Audit Profile</th>
                              <th className="px-8 py-4 text-left hidden lg:table-cell">A.I. Audit Insight</th>
                              <th className="px-8 py-4 text-center">Protocol Actions</th>
                              <th className="px-8 py-4 text-right">Metric</th>
                            </tr>
                          </thead>
                          <tbody>
                            {scores
                              .filter(s => {
                                const nameMatch = (s.name || '').toLowerCase().includes(searchTerm.toLowerCase())
                                const score = typeof s.score_percent === 'number' ? s.score_percent : parseFloat(s.score_percent || 0)
                                const scoreMatch = scoreFilter === 'all' ? true : scoreFilter === 'high' ? score > 80 : score < 50
                                return nameMatch && scoreMatch
                              })
                              .map((s, idx) => {
                                const score = typeof s.score_percent === 'number' ? s.score_percent : parseFloat(s.score_percent || 0);
                                const perfColor = score >= 80 ? '#00C896' : score >= 50 ? '#FF9F00' : '#FF3D3D';
                                const perfBg = score >= 80 ? 'bg-[#00C896]/5' : score >= 50 ? 'bg-[#FF9F00]/10' : 'bg-[#FF3D3D]/10';
                                const perfBorder = score >= 80 ? 'border-[#00C896]/10' : score >= 50 ? 'border-[#FF9F00]/20' : 'border-[#FF3D3D]/20';

                                return (
                                  <tr key={idx} className={`group hover:scale-[1.01] transition-all duration-300`}>
                                    {/* Serial Number */}
                                    <td className={`${perfBg} group-hover:bg-white px-8 py-6 rounded-l-[30px] border-y border-l ${perfBorder} group-hover:shadow-lg transition-all`}>
                                      <span className="text-[10px] font-black tabular-nums opacity-40" style={{ color: perfColor }}>{String(idx + 1).padStart(2, '0')}</span>
                                    </td>

                                    {/* Student Name */}
                                    <td className={`${perfBg} group-hover:bg-white px-8 py-6 border-y ${perfBorder} group-hover:shadow-lg transition-all`}>
                                      <div className="flex flex-col gap-1">
                                        <span className="text-sm font-black text-[#003B46] tracking-tight truncate max-w-[150px] uppercase">
                                          {s.name || `Unit ${idx + 1}`}
                                        </span>
                                        <div className="flex items-center gap-2">
                                          <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: perfColor }}></span>
                                          <span className="text-[8px] font-black uppercase tracking-widest" style={{ color: perfColor }}>
                                            {score >= 80 ? 'Excellent' : score >= 50 ? 'Steady' : 'Alert'}
                                          </span>
                                          {s.plagiarism && s.plagiarism.length > 0 && (
                                            <>
                                              <span className="w-1 h-3 bg-red-200 mx-1"></span>
                                              <span className="text-[8px] font-black uppercase tracking-widest text-red-500 animate-pulse">
                                                Plagiarism Detected
                                              </span>
                                            </>
                                          )}
                                          {s.is_overridden && (
                                            <>
                                              <span className="w-1 h-3 bg-blue-200 mx-1"></span>
                                              <span className="text-[8px] font-black uppercase tracking-widest text-blue-500">
                                                Manual Changed the score
                                              </span>
                                            </>
                                          )}
                                        </div>
                                      </div>
                                    </td>

                                    {/* Feedback Insight */}
                                    <td className={`${perfBg} group-hover:bg-white px-8 py-6 border-y ${perfBorder} hidden lg:table-cell group-hover:shadow-lg transition-all`}>
                                      <p className="text-[#003B46]/60 font-medium text-[11px] line-clamp-2 italic leading-relaxed max-w-md">
                                        "{s.reasoning || 'No feedback available.'}"
                                      </p>
                                    </td>

                                    <td className={`${perfBg} group-hover:bg-white px-8 py-6 border-y ${perfBorder} group-hover:shadow-lg transition-all`}>
                                      <div className="flex items-center justify-center gap-2">
                                        <button
                                          onClick={() => setSelectedStudent(s)}
                                          className="p-3 bg-[#003B46] text-white rounded-2xl hover:bg-[#00252D] hover:scale-110 transition-all shadow-md flex items-center gap-2 px-5"
                                        >
                                          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor font-black"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                                          <span className="text-[8px] font-black uppercase tracking-widest hidden xl:inline">View Results</span>
                                        </button>
                                        <div className="h-6 w-px bg-black/5 mx-1"></div>
                                        <button onClick={() => handleDownloadStudentPdf(s, idx)} className="p-2.5 bg-white/50 text-[#003B46]/60 hover:text-[#00C896] hover:bg-white rounded-xl transition-all border border-transparent hover:border-gray-100" title="Export PDF">
                                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" /></svg>
                                        </button>
                                        <button onClick={() => handleDownloadStudentDoc(s, idx)} className="p-2.5 bg-white/50 text-[#003B46]/60 hover:text-[#0081C9] hover:bg-white rounded-xl transition-all border border-transparent hover:border-gray-100" title="Export DOC">
                                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                                        </button>
                                        <div className="h-6 w-px bg-black/5 mx-1"></div>

                                        <button
                                          onClick={() => handleReevaluate(s, idx)}
                                          disabled={reevaluating[idx]}
                                          className="py-3 px-5 bg-white text-[#003B46] rounded-2xl border-2 border-[#003B46]/10 hover:border-[#003B46] hover:bg-[#003B46] hover:text-white transition-all active:scale-95 disabled:opacity-30 flex items-center gap-2 shadow-sm"
                                        >
                                          <svg className={`w-3.5 h-3.5 ${reevaluating[idx] ? 'animate-spin' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                                          <span className="text-[9px] font-black uppercase tracking-widest">Re-evaluate</span>
                                        </button>
                                      </div>
                                    </td>

                                    {/* Final Score */}
                                    <td className={`${perfBg} group-hover:bg-white px-8 py-6 rounded-r-[30px] border-y border-r ${perfBorder} group-hover:shadow-lg transition-all text-right`}>
                                      <div className="flex flex-col items-end">
                                        <span className="text-3xl font-black italic tracking-tighter tabular-nums leading-none" style={{ color: perfColor }}>
                                          {typeof s.score_percent === 'number' ? s.score_percent.toFixed(0) : s.score_percent}
                                        </span>
                                        <span className="text-[8px] font-black opacity-30 tracking-[2px] uppercase mt-1">Percent</span>
                                      </div>
                                    </td>
                                  </tr>
                                );
                              })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </>
        )}
      </div>
      <Snackbar
        open={toast.open}
        autoHideDuration={6000}
        onClose={handleToastClose}
        anchorOrigin={{ vertical: 'top', horizontal: 'right' }}
      >
        <Alert onClose={handleToastClose} severity={toast.severity} variant="filled" sx={{ width: '100%' }}>
          {toast.message}
        </Alert>
      </Snackbar>

      {/* Student Details Modal */}
      <Dialog
        open={Boolean(selectedStudent)}
        onClose={() => setSelectedStudent(null)}
        maxWidth="md"
        fullWidth
        PaperProps={{
          style: {
            borderRadius: '40px',
            padding: '20px',
            backgroundColor: '#fff',
          }
        }}
      >
        <DialogTitle sx={{ m: 0, p: 3, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span className="text-3xl font-black text-[#003B46] tracking-tighter uppercase">
            {selectedStudent?.name || 'Student Result'}
          </span>
          <IconButton
            aria-label="close"
            onClick={() => setSelectedStudent(null)}
            sx={{
              color: '#003B46',
            }}
          >
            <CloseIcon />
          </IconButton>
        </DialogTitle>
        <DialogContent dividers sx={{ p: 4 }}>
          {selectedStudent && (
            <div className="space-y-6 md:space-y-8">
              {/* Overall Score */}
              <div className="bg-[#003B46] p-6 md:p-10 rounded-[35px] md:rounded-[45px] shadow-2xl flex flex-col items-center justify-between gap-6 md:gap-8 relative overflow-hidden">
                <div className="absolute top-0 right-0 p-6 md:p-10 opacity-[0.03] hidden sm:block">
                  <svg className="w-24 h-24 md:w-40 md:h-40 text-white" fill="currentColor" viewBox="0 0 24 24"><path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-5 14h-2V9h-2V7h4v10z" /></svg>
                </div>

                <div className="w-full text-center sm:text-left z-10 flex-col sm:flex-row flex items-center gap-6">
                  <div className="flex-1">
                    <h4 className="text-[9px] md:text-[10px] font-black text-[#00A896] uppercase tracking-[4px] md:tracking-[6px] mb-3 md:mb-4">Master Audit Performance</h4>
                    <p className="text-base md:text-xl font-medium text-white/90 leading-relaxed italic">"{selectedStudent.reasoning || 'Overall analysis auto-generated.'}"</p>
                  </div>

                  {selectedStudent.score_percent !== null && (
                    <div className="relative group shrink-0">
                      <div className="w-24 h-24 md:w-32 md:h-32 transform group-hover:scale-105 transition-transform duration-500">
                        <svg className="w-full h-full" viewBox="0 0 36 36">
                          <circle className="text-white/10" stroke="currentColor" strokeWidth="3" fill="transparent" cx="18" cy="18" r="15.915" />
                          <circle className="text-[#00A896] drop-shadow-[0_0_8px_rgba(0,168,150,0.5)]" stroke="currentColor" strokeWidth="3" strokeDasharray={`${selectedStudent.score_percent}, 100`} strokeLinecap="round" fill="transparent" cx="18" cy="18" r="15.915" transform="rotate(-90 18 18)" />
                        </svg>
                        <div className="absolute inset-0 flex flex-col items-center justify-center">
                          <span className="text-2xl md:text-3xl font-black text-white leading-none">
                            {typeof selectedStudent.score_percent === 'number' ? selectedStudent.score_percent.toFixed(0) : selectedStudent.score_percent}
                          </span>
                          <span className="text-[8px] md:text-[10px] font-black text-[#00A896] uppercase tracking-widest mt-0.5 md:mt-1">%</span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Plagiarism Analysis Section */}
              {selectedStudent.plagiarism && selectedStudent.plagiarism.length > 0 && (
                <div className="bg-red-50 border-2 border-red-100 p-6 md:p-8 rounded-[35px] md:rounded-[45px] space-y-4 animate-slide-in">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-red-500 rounded-full flex items-center justify-center text-white animate-pulse">
                      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                    </div>
                    <h4 className="text-[10px] font-black text-red-500 uppercase tracking-[4px]">P2P Integrity Alert</h4>
                  </div>
                  <div className="space-y-3">
                    {selectedStudent.plagiarism.map((alert, aIdx) => (
                      <div key={aIdx} className="bg-white p-4 rounded-2xl border border-red-100 flex items-center justify-between shadow-sm">
                        <div>
                          <p className="text-xs font-black text-[#003B46] uppercase">High Similarity with {alert.with}</p>
                          <p className="text-[9px] font-bold text-red-400 uppercase tracking-widest mt-1">Detected in Question {alert.question_index}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-xl font-black text-red-500 italic leading-none">{alert.similarity}%</p>
                          <p className="text-[8px] font-black text-red-300 uppercase tracking-widest mt-1">Match</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Individual Question Details */}
              {selectedStudent.details && selectedStudent.details.length > 0 ? (
                <div className="space-y-4 md:space-y-6">
                  <h4 className="text-[9px] md:text-[10px] font-black text-[#003B46]/30 uppercase tracking-[4px] md:tracking-[5px]">Detailed Audit Log</h4>
                  {selectedStudent.details.map((detail, dIdx) => (
                    <div key={dIdx} className="bg-gray-50 border border-gray-100 p-4 md:p-8 rounded-[25px] md:rounded-[30px] space-y-4">
                      <div className="flex justify-between items-start">
                        <h5 className="font-black text-[#003B46] uppercase text-xs tracking-widest">Question {dIdx + 1}</h5>
                        <div className={`px-4 py-1 rounded-full text-[9px] font-black uppercase tracking-widest ${detail.is_correct ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                          {detail.is_correct ? 'Correct' : 'Incorrect'} ({
                            manualOverrides[detail.id]?.manual_score !== undefined
                              ? manualOverrides[detail.id].manual_score
                              : (detail.manual_score !== undefined && detail.is_overridden ? detail.manual_score : (detail.score !== undefined ? detail.score : (detail.partial_credit || 0)))
                          }/1)
                        </div>
                      </div>
                      <div className="space-y-4">
                        {/* Question Section */}
                        <div className="bg-white p-5 rounded-[25px] md:rounded-[30px] border border-gray-100 shadow-sm relative overflow-hidden">
                          <div className="absolute top-0 left-0 w-1 h-full bg-[#00A896]"></div>
                          <p className="text-[10px] font-black text-[#00A896] uppercase tracking-[3px] mb-3">Question</p>
                          <p className="text-sm font-bold text-[#003B46] leading-relaxed">{detail.question}</p>
                        </div>

                        {/* Student Answer Section */}
                        <div className="bg-white p-5 rounded-[25px] md:rounded-[30px] border border-gray-100 shadow-sm">
                          <p className="text-[10px] font-black text-[#00A896] uppercase tracking-[3px] mb-3">Student Answer</p>
                          <p className="text-sm font-semibold text-[#003B46] whitespace-pre-wrap leading-relaxed">
                            {detail.answer || detail.student_answer || 'N/A'}
                          </p>
                        </div>

                        {/* Correct Answer Section */}
                        <div className="bg-[#003B46]/[0.02] p-5 rounded-[25px] md:rounded-[30px] border border-[#003B46]/10 shadow-sm">
                          <p className="text-[10px] font-black text-[#003B46]/40 uppercase tracking-[3px] mb-3">Correct Answer</p>
                          <p className="text-sm font-medium text-[#003B46]/70 italic whitespace-pre-wrap leading-relaxed">
                            {detail.correct_answer || 'N/A'}
                          </p>
                        </div>

                        {/* Feedback Section */}
                        <div className="bg-[#003B46]/5 p-5 rounded-[25px] md:rounded-[30px] border border-[#003B46]/10">
                          <p className="text-[10px] font-black text-[#003B46]/30 uppercase tracking-[3px] mb-2">A.I. Feedback</p>
                          <p className="text-sm font-bold text-[#003B46]/70 italic leading-relaxed">
                            {detail.feedback || 'No granular feedback provided.'}
                          </p>
                        </div>

                        {/* Manual Override Section */}
                        <div className="pt-4 border-t border-dashed border-[#003B46]/10 space-y-4">
                          <div className="flex flex-wrap items-center justify-between gap-4">
                            <div className="space-y-2">
                              <p className="text-[9px] font-black text-[#00A896] uppercase tracking-widest">Override Grade</p>
                              <div className="flex gap-2">
                                {[0, 0.25, 0.5, 0.75, 1].map(val => {
                                  const currentScore = manualOverrides[detail.id]?.manual_score !== undefined
                                    ? manualOverrides[detail.id].manual_score
                                    : detail.score
                                  const isActive = currentScore === val

                                  return (
                                    <button
                                      key={val}
                                      onClick={() => handleOverrideChange(detail.id, 'manual_score', val)}
                                      className={`px-3 py-1.5 rounded-lg text-[10px] font-black transition-all border-2 ${isActive
                                        ? 'bg-[#00A896] text-white border-[#00A896]'
                                        : 'bg-white text-[#003B46]/40 border-[#003B46]/5 hover:border-[#003B46]/20'
                                        }`}
                                    >
                                      {val === 0 ? '0' : val === 1 ? '1.0' : val}
                                    </button>
                                  )
                                })}
                              </div>
                            </div>

                            {(detail.is_overridden || (manualOverrides[detail.id]?.manual_score !== undefined)) && (
                              <div className="bg-blue-50 px-3 py-1.5 rounded-xl border border-blue-100 flex items-center gap-2">
                                <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse"></div>
                                <span className="text-[8px] font-black text-blue-500 uppercase tracking-widest">Teacher Override</span>
                              </div>
                            )}
                          </div>

                          <div className="space-y-2">
                            <p className="text-[9px] font-black text-[#003B46]/40 uppercase tracking-widest">Teacher's Note (Optional)</p>
                            <textarea
                              value={manualOverrides[detail.id]?.teacher_note ?? (detail.teacher_note || '')}
                              onChange={(e) => handleOverrideChange(detail.id, 'teacher_note', e.target.value)}
                              placeholder="Add rationale for this override..."
                              className="w-full bg-white border-2 border-[#003B46]/5 rounded-2xl p-4 text-[11px] font-medium text-[#003B46] outline-none focus:border-[#00A896]/30 transition-all min-h-[80px]"
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-10 opacity-30 font-black uppercase tracking-widest text-xs">
                  No granular data available for this audit.
                </div>
              )}
            </div>
          )}
        </DialogContent>
        <DialogActions sx={{ p: 4, pt: 2, justifyContent: 'space-between' }}>
          <div className="flex gap-4">
            {Object.keys(manualOverrides).length > 0 && (
              <Button
                onClick={handleSaveOverrides}
                disabled={isSavingOverride}
                sx={{
                  backgroundColor: '#00A896',
                  color: 'white',
                  px: 6,
                  py: 2,
                  borderRadius: '20px',
                  fontFamily: 'inherit',
                  fontWeight: 900,
                  fontSize: '10px',
                  letterSpacing: '3px',
                  '&:hover': { backgroundColor: '#003B46' },
                  '&:disabled': { opacity: 0.5 }
                }}
              >
                {isSavingOverride ? 'Saving...' : 'Save Teacher Overrides'}
              </Button>
            )}
          </div>
          <Button
            onClick={() => {
              setSelectedStudent(null)
              setManualOverrides({})
            }}
            sx={{
              backgroundColor: '#003B46',
              color: 'white',
              px: 6,
              py: 2,
              borderRadius: '20px',
              fontFamily: 'inherit',
              fontWeight: 900,
              fontSize: '10px',
              letterSpacing: '3px',
              '&:hover': { backgroundColor: '#00A896' }
            }}
          >
            Close
          </Button>
        </DialogActions>
      </Dialog>
    </div>
  )
}

export default Services
