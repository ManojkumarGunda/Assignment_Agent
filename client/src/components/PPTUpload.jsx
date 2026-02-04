import { useState } from 'react'

const PPTUpload = ({ files, onFilesChange, onRemoveFile, formatFileSize, dragActive, onDragEnter, onDragLeave, onDragOver, onDrop, onError }) => {
  const acceptedTypes = ['.ppt', '.pptx', '.pptm']

  const isValidPPTFile = (file) => {
    const fileName = file.name.toLowerCase()
    return acceptedTypes.some(ext => fileName.endsWith(ext))
  }

  const handleFiles = (selectedFiles) => {
    const fileArray = Array.from(selectedFiles)
    const MAX_SIZE = 30 * 1024 * 1024 // 30MB

    let tooLarge = false
    const validPPTFiles = []
    const invalidTypes = []

    fileArray.forEach(file => {
      if (file.size > MAX_SIZE) {
        tooLarge = true
      } else if (isValidPPTFile(file)) {
        validPPTFiles.push(file)
      } else {
        invalidTypes.push(file)
      }
    })

    if (tooLarge) {
      if (onError) onError('File size exceeds 30MB limit.')
    }

    if (invalidTypes.length > 0) {
      if (onError) onError('Invalid file! Only PPT, PPTX, and PPTM files are allowed.')
      else alert('Invalid file! Only PPT, PPTX, and PPTM files are allowed.')
    }

    if (validPPTFiles.length > 0) {
      onFilesChange(prev => [...prev, ...validPPTFiles])
    }
  }

  const handleFileInput = (e) => {
    if (e.target.files && e.target.files[0]) {
      handleFiles(e.target.files)
    }
  }

  const handleDrop = (e) => {
    e.preventDefault()
    e.stopPropagation()
    if (onDrop) onDrop(e)

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFiles(e.dataTransfer.files)
    }
  }

  return (
    <div>
      <div
        className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${dragActive
          ? 'border-indigo-500 bg-indigo-50'
          : 'border-gray-300 hover:border-indigo-400'
          }`}
        onDragEnter={onDragEnter}
        onDragLeave={onDragLeave}
        onDragOver={onDragOver}
        onDrop={handleDrop}
      >
        <svg className="mx-auto h-12 w-12 text-gray-400 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
        </svg>
        <p className="text-gray-600 mb-2">
          <span className="font-semibold text-indigo-600">Click to upload</span> or drag and drop
        </p>
        <p className="text-sm text-gray-500 mb-4">
          Multiple PowerPoint files supported (PPT, PPTX, PPTM)
        </p>
        <input
          type="file"
          multiple
          accept=".ppt,.pptx,.pptm"
          onChange={handleFileInput}
          className="hidden"
          id="ppt-upload"
        />
        <label
          htmlFor="ppt-upload"
          className="inline-block bg-indigo-600 text-white px-6 py-2 rounded-lg hover:bg-indigo-700 cursor-pointer transition"
        >
          Select PPT Files
        </label>
      </div>

      {/* Uploaded Files List */}
      {files.length > 0 && (
        <div className="mt-6">
          <h3 className="text-lg font-semibold text-gray-800 mb-3">
            Uploaded PPT Files ({files.length})
          </h3>
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {files.map((file, index) => (
              <div
                key={index}
                className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition"
              >
                <div className="flex items-center space-x-3 flex-1 min-w-0">
                  <svg
                    className="w-5 h-5 text-indigo-600 flex-shrink-0"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z"
                    />
                  </svg>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-800 truncate">
                      {file.name}
                    </p>
                    <p className="text-xs text-gray-500">
                      {formatFileSize(file.size)}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => onRemoveFile(index)}
                  className="ml-2 text-red-600 hover:text-red-700 transition"
                  title="Remove file"
                >
                  <svg
                    className="w-5 h-5"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M6 18L18 6M6 6l12 12"
                    />
                  </svg>
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

export default PPTUpload

