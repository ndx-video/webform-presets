# Webform Sync API Test Suite
# Comprehensive testing of all endpoints

$ErrorActionPreference = "Continue"
$BaseUrl = "http://localhost:8765/api/v1"
$TestsPassed = 0
$TestsFailed = 0
$DeviceId = "test-device-$(Get-Random)"

Write-Host "`n╔══════════════════════════════════════════════════════════════╗" -ForegroundColor Cyan
Write-Host "║  Webform Sync Service - API Test Suite                      ║" -ForegroundColor Cyan
Write-Host "╚══════════════════════════════════════════════════════════════╝`n" -ForegroundColor Cyan

function Test-Endpoint {
    param(
        [string]$Name,
        [string]$Method,
        [string]$Url,
        [object]$Body = $null,
        [int]$ExpectedStatus = 200,
        [string]$ExpectedContent = $null
    )
    
    Write-Host "Testing: " -NoNewline
    Write-Host "$Name" -ForegroundColor Yellow
    Write-Host "  Method: $Method $Url" -ForegroundColor Gray
    
    try {
        $params = @{
            Uri = $Url
            Method = $Method
            ContentType = "application/json"
            ErrorAction = "Stop"
        }
        
        if ($Body) {
            $params.Body = ($Body | ConvertTo-Json -Depth 10)
            Write-Host "  Body: $($params.Body)" -ForegroundColor Gray
        }
        
        $response = Invoke-WebRequest @params
        
        Write-Host "  Status: $($response.StatusCode)" -ForegroundColor Gray
        Write-Host "  Response: $($response.Content.Substring(0, [Math]::Min(200, $response.Content.Length)))" -ForegroundColor Gray
        
        if ($response.StatusCode -eq $ExpectedStatus) {
            if ($ExpectedContent -and $response.Content -notmatch $ExpectedContent) {
                Write-Host "  ✗ FAILED - Expected content not found: $ExpectedContent`n" -ForegroundColor Red
                $script:TestsFailed++
                return $null
            }
            Write-Host "  ✓ PASSED`n" -ForegroundColor Green
            $script:TestsPassed++
            return $response.Content | ConvertFrom-Json
        } else {
            Write-Host "  ✗ FAILED - Expected $ExpectedStatus, got $($response.StatusCode)`n" -ForegroundColor Red
            $script:TestsFailed++
            return $null
        }
    }
    catch {
        Write-Host "  ✗ FAILED - $($_.Exception.Message)`n" -ForegroundColor Red
        $script:TestsFailed++
        return $null
    }
}

# Test 1: Health Check
Write-Host "`n═══ Test 1: Health Check ═══" -ForegroundColor Cyan
$health = Test-Endpoint -Name "Health Check" -Method "GET" -Url "$BaseUrl/health" -ExpectedContent "healthy"

# Test 2: Get Empty Presets List
Write-Host "`n═══ Test 2: Get Empty Presets ═══" -ForegroundColor Cyan
$presets = Test-Endpoint -Name "Get Presets (Empty)" -Method "GET" -Url "$BaseUrl/presets?device_id=$DeviceId"

# Test 3: Create First Preset
Write-Host "`n═══ Test 3: Create Preset ═══" -ForegroundColor Cyan
$preset1 = @{
    deviceId = $DeviceId
    name = "Test Login Form"
    scopeType = "url"
    scopeValue = "https://example.com/login"
    fields = @{
        username = "testuser"
        email = "test@example.com"
        password = "encrypted:abc123"
    }
    encrypted = $true
}
$created1 = Test-Endpoint -Name "Create Preset 1" -Method "POST" -Url "$BaseUrl/presets" -Body $preset1 -ExpectedStatus 201

# Test 4: Create Second Preset
Write-Host "`n═══ Test 4: Create Another Preset ═══" -ForegroundColor Cyan
$preset2 = @{
    deviceId = $DeviceId
    name = "Contact Form"
    scopeType = "domain"
    scopeValue = "example.com"
    fields = @{
        name = "John Doe"
        email = "john@example.com"
        phone = "555-1234"
    }
    encrypted = $false
}
$created2 = Test-Endpoint -Name "Create Preset 2" -Method "POST" -Url "$BaseUrl/presets" -Body $preset2 -ExpectedStatus 201

# Test 5: Get All Presets
Write-Host "`n═══ Test 5: Get All Presets ═══" -ForegroundColor Cyan
$allPresets = Test-Endpoint -Name "Get All Presets" -Method "GET" -Url "$BaseUrl/presets?device_id=$DeviceId"
if ($allPresets -and $allPresets.presets.Count -eq 2) {
    Write-Host "  ✓ Found 2 presets as expected" -ForegroundColor Green
} else {
    Write-Host "  ✗ Expected 2 presets, found $($allPresets.presets.Count)" -ForegroundColor Red
}

# Test 6: Get Preset by ID
Write-Host "`n═══ Test 6: Get Preset by ID ═══" -ForegroundColor Cyan
if ($created1) {
    $presetById = Test-Endpoint -Name "Get Preset by ID" -Method "GET" -Url "$BaseUrl/presets/$($created1.preset.id)?device_id=$DeviceId"
}

# Test 7: Get Presets by Scope (URL)
Write-Host "`n═══ Test 7: Get Presets by Scope (URL) ═══" -ForegroundColor Cyan
$urlPresets = Test-Endpoint -Name "Get Presets by URL Scope" -Method "GET" -Url "$BaseUrl/presets/scope/url/https://example.com/login"

# Test 8: Get Presets by Scope (Domain)
Write-Host "`n═══ Test 8: Get Presets by Scope (Domain) ═══" -ForegroundColor Cyan
$domainPresets = Test-Endpoint -Name "Get Presets by Domain Scope" -Method "GET" -Url "$BaseUrl/presets/scope/domain/example.com"

# Test 9: Update Preset
Write-Host "`n═══ Test 9: Update Preset ═══" -ForegroundColor Cyan
if ($created1) {
    $updateData = @{
        deviceId = $DeviceId
        name = "Updated Login Form"
        fields = @{
            username = "updateduser"
            email = "updated@example.com"
            password = "encrypted:xyz789"
        }
    }
    $updated = Test-Endpoint -Name "Update Preset" -Method "PUT" -Url "$BaseUrl/presets/$($created1.preset.id)" -Body $updateData
}

# Test 10: Verify Update
Write-Host "`n═══ Test 10: Verify Update ═══" -ForegroundColor Cyan
if ($created1) {
    $verified = Test-Endpoint -Name "Get Updated Preset" -Method "GET" -Url "$BaseUrl/presets/$($created1.preset.id)?device_id=$DeviceId" -ExpectedContent "Updated Login Form"
}

# Test 11: Get Devices List
Write-Host "`n═══ Test 11: Get Devices ═══" -ForegroundColor Cyan
$devices = Test-Endpoint -Name "Get Devices" -Method "GET" -Url "$BaseUrl/devices"

# Test 12: Get Sync Log
Write-Host "`n═══ Test 12: Get Sync Log ═══" -ForegroundColor Cyan
$syncLog = Test-Endpoint -Name "Get Sync Log" -Method "GET" -Url "$BaseUrl/sync/log?limit=10"

# Test 13: Create Preset with URL Filter
Write-Host "`n═══ Test 13: Test URL Filtering ═══" -ForegroundColor Cyan
$preset3 = @{
    deviceId = $DeviceId
    name = "GitHub Form"
    scopeType = "url"
    scopeValue = "https://github.com/login"
    fields = @{
        username = "githubuser"
    }
    encrypted = $false
}
$created3 = Test-Endpoint -Name "Create GitHub Preset" -Method "POST" -Url "$BaseUrl/presets" -Body $preset3 -ExpectedStatus 201

# Test 14: Invalid Device ID
Write-Host "`n═══ Test 14: Test Missing Device ID ═══" -ForegroundColor Cyan
$invalidPreset = @{
    name = "Invalid Preset"
    fields = @{ test = "value" }
}
Test-Endpoint -Name "Missing Device ID" -Method "POST" -Url "$BaseUrl/presets" -Body $invalidPreset -ExpectedStatus 400

# Test 15: Invalid Scope Type
Write-Host "`n═══ Test 15: Test Invalid Scope Type ═══" -ForegroundColor Cyan
Test-Endpoint -Name "Invalid Scope Type" -Method "GET" -Url "$BaseUrl/presets/scope/invalid/example.com" -ExpectedStatus 400

# Test 16: Delete Preset
Write-Host "`n═══ Test 16: Delete Preset ═══" -ForegroundColor Cyan
if ($created2) {
    $deleted = Test-Endpoint -Name "Delete Preset" -Method "DELETE" -Url "$BaseUrl/presets/$($created2.preset.id)?device_id=$DeviceId"
}

# Test 17: Verify Deletion
Write-Host "`n═══ Test 17: Verify Deletion ═══" -ForegroundColor Cyan
if ($created2) {
    try {
        $response = Invoke-WebRequest -Uri "$BaseUrl/presets/$($created2.preset.id)?device_id=$DeviceId" -Method GET -ErrorAction Stop
        Write-Host "  ✗ FAILED - Preset still exists after deletion`n" -ForegroundColor Red
        $script:TestsFailed++
    }
    catch {
        if ($_.Exception.Response.StatusCode.value__ -eq 404) {
            Write-Host "  ✓ PASSED - Preset correctly deleted (404)`n" -ForegroundColor Green
            $script:TestsPassed++
        } else {
            Write-Host "  ✗ FAILED - Unexpected error: $($_.Exception.Message)`n" -ForegroundColor Red
            $script:TestsFailed++
        }
    }
}

# Test 18: Get Remaining Presets Count
Write-Host "`n═══ Test 18: Verify Remaining Presets ═══" -ForegroundColor Cyan
$finalPresets = Test-Endpoint -Name "Get Final Presets" -Method "GET" -Url "$BaseUrl/presets?device_id=$DeviceId"
if ($finalPresets -and $finalPresets.presets.Count -eq 2) {
    Write-Host "  ✓ Correct count: 2 presets remaining" -ForegroundColor Green
} else {
    Write-Host "  ✗ Expected 2 presets, found $($finalPresets.presets.Count)" -ForegroundColor Red
}

# Test 19: Manual Cleanup
Write-Host "`n═══ Test 19: Manual Cleanup ═══" -ForegroundColor Cyan
$cleanup = Test-Endpoint -Name "Manual Cleanup" -Method "POST" -Url "$BaseUrl/sync/cleanup"

# Test 20: Stress Test - Multiple Rapid Requests
Write-Host "`n═══ Test 20: Stress Test (10 Rapid Requests) ═══" -ForegroundColor Cyan
$stressSuccess = 0
for ($i = 1; $i -le 10; $i++) {
    try {
        $response = Invoke-WebRequest -Uri "$BaseUrl/health" -Method GET -ErrorAction Stop
        if ($response.StatusCode -eq 200) { $stressSuccess++ }
    }
    catch {
        Write-Host "  Request $i failed" -ForegroundColor Red
    }
}
Write-Host "  Stress test: $stressSuccess/10 requests succeeded" -ForegroundColor $(if ($stressSuccess -eq 10) { "Green" } else { "Yellow" })
if ($stressSuccess -eq 10) { $script:TestsPassed++ } else { $script:TestsFailed++ }

# Summary
Write-Host "`n╔══════════════════════════════════════════════════════════════╗" -ForegroundColor Cyan
Write-Host "║  Test Summary                                                ║" -ForegroundColor Cyan
Write-Host "╚══════════════════════════════════════════════════════════════╝" -ForegroundColor Cyan
Write-Host "`n  Total Tests: $($TestsPassed + $TestsFailed)" -ForegroundColor White
Write-Host "  Passed: $TestsPassed" -ForegroundColor Green
Write-Host "  Failed: $TestsFailed" -ForegroundColor $(if ($TestsFailed -eq 0) { "Green" } else { "Red" })
Write-Host "  Success Rate: $([math]::Round(($TestsPassed / ($TestsPassed + $TestsFailed)) * 100, 2))%`n" -ForegroundColor $(if ($TestsFailed -eq 0) { "Green" } else { "Yellow" })

if ($TestsFailed -eq 0) {
    Write-Host "  ✓ ALL TESTS PASSED! 🎉`n" -ForegroundColor Green
    exit 0
} else {
    Write-Host "  ✗ Some tests failed. Please review the output above.`n" -ForegroundColor Red
    exit 1
}
