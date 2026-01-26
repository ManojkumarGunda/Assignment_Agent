/**
 * Format label key (convert snake_case to Title Case)
 */
export const formatLabel = (key) => {
  if (!key) return ''
  return key
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (l) => l.toUpperCase())
}

/**
 * Parse JSON result from string
 */
export const parseJsonResult = (value) => {
  if (!value || typeof value !== 'string') return null
  const trimmed = value.trim()
  if (!trimmed.startsWith('{') && !trimmed.startsWith('[')) return null
  try {
    return JSON.parse(trimmed)
  } catch {
    return null
  }
}

/**
 * Render JSON result as React component
 */
export const renderJsonResult = (data, formatLabel) => {
  const renderObject = (obj, idx) => (
    <div
      key={idx}
      className="rounded-md bg-gray-50 p-3 border border-gray-200 space-y-1"
    >
      {Object.entries(obj || {}).map(([k, v]) => (
        <p key={k} className="text-sm text-gray-800">
          <span className="font-medium">{formatLabel(k)}:</span>{' '}
          {typeof v === 'boolean' ? (v ? 'Yes' : 'No') : String(v ?? '')}
        </p>
      ))}
    </div>
  )

  if (Array.isArray(data)) {
    return (
      <div className="space-y-3">
        {data.map((item, idx) =>
          typeof item === 'object' ? renderObject(item, idx) : (
            <div
              key={idx}
              className="rounded-md bg-gray-50 p-3 border border-gray-200 text-sm text-gray-800"
            >
              {String(item)}
            </div>
          )
        )}
      </div>
    )
  }

  if (typeof data === 'object') {
    return renderObject(data, 'single')
  }

  return (
    <div className="rounded-md bg-gray-50 p-3 border border-gray-200 text-sm text-gray-800">
      {String(data)}
    </div>
  )
}

/**
 * Validate GitHub URL
 */
export const isValidGitHubUrl = (value) => {
  if (!value) return false
  try {
    const url = new URL(value)
    return /(^|\.)github\.com$/.test(url.hostname)
  } catch {
    return false
  }
}

/**
 * Format file size
 */
export const formatFileSize = (bytes) => {
  if (bytes === 0) return '0 Bytes'
  const k = 1024
  const sizes = ['Bytes', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i]
}

