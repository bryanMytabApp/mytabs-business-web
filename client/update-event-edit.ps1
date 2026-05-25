# Script to update EventEdit.jsx with DatePicker layout

$filePath = "src/views/Events/EventEdit.jsx"
$content = Get-Content $filePath -Raw

# Add state variables after businessData
$content = $content -replace `
  '(const \[businessData, setBusinessData\] = useState\(null\))\s+(const routeProps = useParams\(\))', `
  '$1
  const [datePickerOpen, setDatePickerOpen] = useState(false)
  const startTimeInputRef = useRef(null)
  const endTimeInputRef = useRef(null)
  $2'

# Save the file
$content | Set-Content $filePath -NoNewline

Write-Host "Updated EventEdit.jsx successfully!"
