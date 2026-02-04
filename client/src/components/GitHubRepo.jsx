import { useState, useEffect } from 'react'

const isValidGitHubUrl = (value) => {
  try {
    const url = new URL(value)
    return /(^|\.)github\.com$/.test(url.hostname)
  } catch {
    return false
  }
}

const GitHubRepo = ({ value, onChange }) => {
  const [url, setUrl] = useState(value || '')
  const [valid, setValid] = useState(!value || isValidGitHubUrl(value))

  useEffect(() => {
    setValid(!url || isValidGitHubUrl(url))
  }, [url])

  const handleInput = (e) => {
    const v = e.target.value
    setUrl(v)
    if (onChange) onChange(v)
  }

  return (
    <div className="bg-white rounded-xl shadow-md p-6 mt-8">
      <h2 className="text-2xl font-bold text-gray-800 mb-4">GitHub Repository</h2>
      <p className="text-gray-600 mb-4">Paste a public GitHub repository URL if you want the model to consider it along with uploaded files.</p>
      <label htmlFor="github-url" className="block text-sm font-medium text-gray-700 mb-2">Repository URL</label>
      <input
        id="github-url"
        type="url"
        value={url}
        onChange={handleInput}
        placeholder="https://github.com/owner/repo"
        className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition ${valid ? 'border-gray-300' : 'border-red-400'}`}
      />
      {!valid && (
        <p className="mt-2 text-sm text-red-600">Please enter a valid github.com URL.</p>
      )}
      <p className="mt-3 text-xs text-gray-500">Currently supports public repositories. Private repos are not fetched; the URL will be included in the prompt context.</p>
    </div>
  )
}

export default GitHubRepo
