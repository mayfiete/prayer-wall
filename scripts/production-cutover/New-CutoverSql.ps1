param(
  [Parameter(Mandatory=$true)][string]$SnapshotPath,
  [Parameter(Mandatory=$true)][ValidateSet('Delete','Restore')][string]$Mode,
  [Parameter(Mandatory=$true)][string]$OutputPath
)
$ErrorActionPreference = 'Stop'
$snapshotFile = (Resolve-Path -LiteralPath $SnapshotPath).Path
$snapshotText = [System.IO.File]::ReadAllText($snapshotFile).Trim()
$snapshotData = $snapshotText | ConvertFrom-Json
if ($snapshotData.format -ne 'prayer-wall-cleanup-v1') {
  throw 'Expected the raw snapshot_json object from 01_snapshot.sql, not a CSV or wrapper array.'
}
if (@($snapshotData.wall_ids).Count -eq 0) { throw 'Snapshot has no wall IDs.' }
foreach ($wallId in $snapshotData.wall_ids) { [void][guid]::Parse($wallId) }
$tableNames = @('commitments','donations','commitment_categories','commitment_rhythms','prayer_points','email_logs','webhook_events')
foreach ($tableName in $tableNames) {
  if ($snapshotData.tables.PSObject.Properties.Name -notcontains $tableName) {
    throw "Snapshot is missing $tableName."
  }
}
Write-Output 'Review these backup counts before proceeding:'
foreach ($tableName in $tableNames) {
  Write-Output ('{0}: {1}' -f $tableName, @($snapshotData.tables.$tableName).Count)
}
$templateName = if ($Mode -eq 'Delete') { '02_delete_test_activity.sql' } else { '03_restore_snapshot.sql' }
$template = [System.IO.File]::ReadAllText((Join-Path $PSScriptRoot $templateName))
do { $delimiter = '$cutover_' + [guid]::NewGuid().ToString('N') + '$' }
while ($snapshotText.Contains($delimiter))
$result = $template.Replace('$snapshot$PASTE_COMPLETE_SNAPSHOT_JSON_HERE$snapshot$', $delimiter + $snapshotText + $delimiter)
$resolvedOutput = [System.IO.Path]::GetFullPath($OutputPath)
if (Test-Path -LiteralPath $resolvedOutput) { throw 'Output already exists. Choose a new filename.' }
if ($resolvedOutput -eq $snapshotFile) { throw 'Output cannot overwrite the snapshot.' }
[System.IO.File]::WriteAllText($resolvedOutput, $result, (New-Object System.Text.UTF8Encoding($false)))
Write-Output "Created $resolvedOutput. It ends in ROLLBACK: running it is a dry run."
Write-Output 'This SQL contains personal data. Store it with your backup, outside the repository.'
