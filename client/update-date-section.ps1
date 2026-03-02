# Script to replace DateTimePicker section with DatePicker + time inputs

$filePath = "src/views/Events/EventEdit.jsx"
$content = Get-Content $filePath -Raw

# Define the old section to replace (DateTimePicker section)
$oldSection = @'
                    <div style={{ display: 'flex', flexDirection: 'column', width: '100%' }}>
                      <div className={styles.title} style={{ marginBottom: 0 }}>
                        Date and Time
                      </div>
                      {/* Date, Start Time, End Time on one line */}
                      <div style={{ display: 'flex', gap: '20px', marginBottom: '20px', width: '100%' }}>
                        <DemoContainer components={['DateTimePicker']} sx={{ flex: 1 }} >
                          <DateTimePicker
                            sx={{
                              display: 'flex',
                              background: '#FCFCFC',
                              borderRadius: '10px !important',
                              boxShadow: '0px 4.679279327392578px 9.358558654785156px 0px #32324702',
                              boxShadow: '0px 4.679279327392578px 4.679279327392578px 0px #00000014',
                              minHeight: '28px',
                              '& .MuiOutlinedInput-notchedOutline': {
                                border: 'none',
                                borderRadius: '10px'
                              },
                              '& .MuiInputLabel-root': {
                                transformOrigin: '0px 35px'
                              },
                            }}
                            value={item.startDate}
                            label="Start time" 
                            maxDateTime={item.endDate}
                            minDateTime={moment()}
                            onChange={(newValue) => handleItemChange('startDate', newValue)}
                          />
                        </DemoContainer>
                        <DemoContainer components={['DateTimePicker']} sx={{ flex: 1 }} >
                          <DateTimePicker
                            value={item.endDate}
                            label="End time"
                            sx={{
                              display: 'flex',
                              background: '#FCFCFC',
                              borderRadius: '10px',
                              boxShadow: '0px 4.679279327392578px 9.358558654785156px 0px #32324702',
                              boxShadow: '0px 4.679279327392578px 4.679279327392578px 0px #00000014',
                              minHeight: '28px',
                              '& .MuiOutlinedInput-notchedOutline': {
                                border: 'none'
                              },
                              '& .MuiInputLabel-root': {
                                transformOrigin: '0px 35px'
                              },
                            }}
                            minDateTime={item.startDate}
                            onChange={(newValue) => handleItemChange('endDate', newValue)}
                          />
                        </DemoContainer>
                      </div>
                      
                      {/* Address fields below */}
                      <div className={styles.title} style={{ marginBottom: 0 }}>
                        Location
                      </div>
'@

# Define the new section (DatePicker + time inputs)
$newSection = @'
                    <div style={{ display: 'flex', flexDirection: 'column', width: '100%' }}>
                      <div className={styles.title} style={{ marginBottom: 0 }}>
                        Date and Time
                      </div>
                      {/* Date Picker - Full Width */}
                      <div style={{ width: '100%', marginBottom: '20px' }}>
                        <DemoContainer components={['DatePicker']} sx={{ width: '100%' }} >
                          <DatePicker
                            open={datePickerOpen}
                            onOpen={() => setDatePickerOpen(true)}
                            onClose={() => setDatePickerOpen(false)}
                            sx={{
                              width: '100%',
                              background: '#FCFCFC',
                              borderRadius: '10px',
                              boxShadow: '0px 4.679279327392578px 9.358558654785156px 0px #32324702',
                              boxShadow: '0px 4.679279327392578px 4.679279327392578px 0px #00000014',
                              minHeight: '28px',
                              '& .MuiOutlinedInput-notchedOutline': {
                                border: 'none'
                              },
                              '& .MuiInputLabel-root': {
                                transformOrigin: '0px 35px'
                              },
                            }}
                            value={item.startDate}
                            label="Pick a date"
                            minDate={moment()}
                            onChange={(newValue) => {
                              // Update both start and end date to the same date, preserving times
                              const newStartDate = moment(newValue)
                                .hour(item.startDate ? moment(item.startDate).hour() : 0)
                                .minute(item.startDate ? moment(item.startDate).minute() : 0)
                              
                              const newEndDate = moment(newValue)
                                .hour(item.endDate ? moment(item.endDate).hour() : 0)
                                .minute(item.endDate ? moment(item.endDate).minute() : 0)
                              
                              setItem(prev => ({
                                ...prev,
                                startDate: newStartDate,
                                endDate: newEndDate
                              }))
                              setHasChanged(true)
                            }}
                            slotProps={{
                              textField: {
                                onClick: () => setDatePickerOpen(true)
                              }
                            }}
                          />
                        </DemoContainer>
                      </div>
                      
                      {/* Start and End Time - On Same Line */}
                      <div style={{ width: '100%', display: 'flex', gap: '20px', marginBottom: '20px' }}>
                        {/* Start Time */}
                        <div style={{ flex: '1' }}>
                          <div style={{ 
                            fontSize: '13px', 
                            fontWeight: 500, 
                            color: '#666', 
                            marginBottom: '8px',
                            fontFamily: 'Outfit'
                          }}>
                            Start time
                          </div>
                          <div 
                            onClick={() => startTimeInputRef.current?.showPicker()}
                            style={{ 
                              display: 'flex',
                              alignItems: 'center',
                              background: '#FCFCFC',
                              borderRadius: '10px',
                              boxShadow: '0px 4.679279327392578px 9.358558654785156px 0px #32324702',
                              padding: '14px',
                              minHeight: '56px',
                              cursor: 'pointer',
                              position: 'relative'
                            }}>
                            <input
                              ref={startTimeInputRef}
                              type="time"
                              value={item.startDate ? moment(item.startDate).format('HH:mm') : ''}
                              onChange={(e) => {
                                const [hours, minutes] = e.target.value.split(':')
                                const newStartDate = moment(item.startDate).hour(hours).minute(minutes)
                                handleItemChange('startDate', newStartDate)
                              }}
                              onClick={(e) => {
                                e.stopPropagation()
                                e.target.showPicker()
                              }}
                              style={{
                                border: 'none',
                                background: 'transparent',
                                fontSize: '16px',
                                fontFamily: 'Roboto, sans-serif',
                                width: '100%',
                                outline: 'none',
                                cursor: 'pointer'
                              }}
                            />
                            <span 
                              className="material-icons" 
                              style={{ 
                                color: '#666',
                                fontSize: '24px',
                                position: 'absolute',
                                right: '14px',
                                pointerEvents: 'none'
                              }}
                            >
                              schedule
                            </span>
                          </div>
                        </div>

                        {/* End Time */}
                        <div style={{ flex: '1' }}>
                          <div style={{ 
                            fontSize: '13px', 
                            fontWeight: 500, 
                            color: '#666', 
                            marginBottom: '8px',
                            fontFamily: 'Outfit'
                          }}>
                            End time
                          </div>
                          <div 
                            onClick={() => endTimeInputRef.current?.showPicker()}
                            style={{ 
                              display: 'flex',
                              alignItems: 'center',
                              background: '#FCFCFC',
                              borderRadius: '10px',
                              boxShadow: '0px 4.679279327392578px 9.358558654785156px 0px #32324702',
                              padding: '14px',
                              minHeight: '56px',
                              cursor: 'pointer',
                              position: 'relative'
                            }}>
                            <input
                              ref={endTimeInputRef}
                              type="time"
                              value={item.endDate ? moment(item.endDate).format('HH:mm') : ''}
                              onChange={(e) => {
                                const [hours, minutes] = e.target.value.split(':')
                                const newEndDate = moment(item.endDate).hour(hours).minute(minutes)
                                handleItemChange('endDate', newEndDate)
                              }}
                              onClick={(e) => {
                                e.stopPropagation()
                                e.target.showPicker()
                              }}
                              style={{
                                border: 'none',
                                background: 'transparent',
                                fontSize: '16px',
                                fontFamily: 'Roboto, sans-serif',
                                width: '100%',
                                outline: 'none',
                                cursor: 'pointer'
                              }}
                            />
                            <span 
                              className="material-icons" 
                              style={{ 
                                color: '#666',
                                fontSize: '24px',
                                position: 'absolute',
                                right: '14px',
                                pointerEvents: 'none'
                              }}
                            >
                              schedule
                            </span>
                          </div>
                        </div>
                      </div>
                      
                      {/* Address fields below */}
                      <div className={styles.title} style={{ marginBottom: 0 }}>
                        Location
                      </div>
'@

# Replace the section
$content = $content -replace [regex]::Escape($oldSection), $newSection

# Save the file
$content | Set-Content $filePath -NoNewline

Write-Host "Updated date/time section successfully!"
