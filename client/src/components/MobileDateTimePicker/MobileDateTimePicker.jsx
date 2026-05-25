import React, { useState, useEffect } from "react";
import moment from "moment";
import styles from "./MobileDateTimePicker.module.css";

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
];

const DAYS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

/**
 * Mobile-friendly Calendar component
 */
const Calendar = ({ selectedDate, onSelectDay, minDate }) => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  const [viewYear, setViewYear] = useState(
    selectedDate ? moment(selectedDate).year() : today.getFullYear()
  );
  const [viewMonth, setViewMonth] = useState(
    selectedDate ? moment(selectedDate).month() : today.getMonth()
  );

  // Update view when selectedDate changes
  useEffect(() => {
    if (selectedDate) {
      setViewYear(moment(selectedDate).year());
      setViewMonth(moment(selectedDate).month());
    }
  }, [selectedDate]);

  const changeMonth = (dir) => {
    setViewMonth((m) => {
      const nm = m + dir;
      if (nm > 11) {
        setViewYear((y) => y + 1);
        return 0;
      }
      if (nm < 0) {
        setViewYear((y) => y - 1);
        return 11;
      }
      return nm;
    });
  };

  const firstDay = new Date(viewYear, viewMonth, 1).getDay();
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();

  const isDateDisabled = (d) => {
    if (!minDate) return false;
    const dt = new Date(viewYear, viewMonth, d);
    dt.setHours(0, 0, 0, 0);
    const min = new Date(minDate);
    min.setHours(0, 0, 0, 0);
    return dt < min;
  };

  const getDayClass = (d) => {
    const dt = new Date(viewYear, viewMonth, d);
    const isSelected = selectedDate && moment(selectedDate).isSame(moment(dt), 'day');
    const isToday = dt.getTime() === today.getTime();
    const disabled = isDateDisabled(d);

    let classes = [styles.dayCell];
    
    if (disabled) {
      classes.push(styles.disabled);
    } else if (isSelected) {
      classes.push(styles.selected);
    } else if (isToday) {
      classes.push(styles.today);
    }

    return classes.join(" ");
  };

  return (
    <div className={styles.calendar}>
      {/* Month/Year Navigation */}
      <div className={styles.calendarHeader}>
        <button
          type="button"
          onClick={() => changeMonth(-1)}
          className={styles.navButton}
        >
          <span className="material-icons">chevron_left</span>
        </button>
        <span className={styles.monthYear}>
          {MONTHS[viewMonth]} {viewYear}
        </span>
        <button
          type="button"
          onClick={() => changeMonth(1)}
          className={styles.navButton}
        >
          <span className="material-icons">chevron_right</span>
        </button>
      </div>

      {/* Day Headers */}
      <div className={styles.dayHeaders}>
        {DAYS.map((day) => (
          <div key={day} className={styles.dayHeader}>
            {day}
          </div>
        ))}
      </div>

      {/* Calendar Grid */}
      <div className={styles.calendarGrid}>
        {/* Empty cells for days before the first of the month */}
        {Array(firstDay)
          .fill(null)
          .map((_, i) => (
            <div key={`empty-${i}`} className={styles.emptyCell} />
          ))}
        {/* Day cells */}
        {Array.from({ length: daysInMonth }, (_, i) => i + 1).map((d) => (
          <button
            key={d}
            type="button"
            className={getDayClass(d)}
            onClick={() => {
              if (!isDateDisabled(d)) {
                onSelectDay(new Date(viewYear, viewMonth, d));
              }
            }}
            disabled={isDateDisabled(d)}
          >
            {d}
          </button>
        ))}
      </div>
    </div>
  );
};

/**
 * Time Picker with hour/minute spinners and AM/PM toggle
 */
const TimePicker = ({ label, value, onChange }) => {
  // Parse the time value (moment object or null)
  const hour24 = value ? moment(value).hour() : 12;
  const minute = value ? moment(value).minute() : 0;
  
  // Convert to 12-hour format
  const hour12 = hour24 === 0 ? 12 : hour24 > 12 ? hour24 - 12 : hour24;
  const ampm = hour24 >= 12 ? "PM" : "AM";

  const handleHourChange = (newHour) => {
    let h = parseInt(newHour) || 12;
    if (h < 1) h = 12;
    if (h > 12) h = 1;
    
    // Convert back to 24-hour
    let hour24New = h;
    if (ampm === "PM" && h !== 12) hour24New = h + 12;
    if (ampm === "AM" && h === 12) hour24New = 0;
    
    onChange({ hour: hour24New });
  };

  const handleMinuteChange = (newMinute) => {
    let m = parseInt(newMinute) || 0;
    if (m < 0) m = 59;
    if (m > 59) m = 0;
    onChange({ minute: m });
  };

  const handleAmPmToggle = () => {
    const newAmPm = ampm === "AM" ? "PM" : "AM";
    let newHour24 = hour24;
    
    if (newAmPm === "PM" && hour24 < 12) {
      newHour24 = hour24 + 12;
    } else if (newAmPm === "AM" && hour24 >= 12) {
      newHour24 = hour24 - 12;
    }
    
    onChange({ hour: newHour24 });
  };

  const incrementHour = () => {
    let newHour = hour12 + 1;
    if (newHour > 12) newHour = 1;
    handleHourChange(newHour);
  };

  const decrementHour = () => {
    let newHour = hour12 - 1;
    if (newHour < 1) newHour = 12;
    handleHourChange(newHour);
  };

  const incrementMinute = () => {
    let newMinute = minute + 1;
    if (newMinute > 59) newMinute = 0;
    handleMinuteChange(newMinute);
  };

  const decrementMinute = () => {
    let newMinute = minute - 1;
    if (newMinute < 0) newMinute = 59;
    handleMinuteChange(newMinute);
  };

  return (
    <div className={styles.timePicker}>
      <label className={styles.timeLabel}>{label}</label>
      <div className={styles.timeInputs}>
        {/* Hour Spinner */}
        <div className={styles.spinnerContainer}>
          <button
            type="button"
            className={styles.spinnerButton}
            onClick={incrementHour}
          >
            <span className="material-icons">expand_less</span>
          </button>
          <input
            type="text"
            value={hour12.toString().padStart(2, "0")}
            onChange={(e) => handleHourChange(e.target.value)}
            className={styles.timeInput}
            maxLength={2}
          />
          <button
            type="button"
            className={styles.spinnerButton}
            onClick={decrementHour}
          >
            <span className="material-icons">expand_more</span>
          </button>
        </div>

        <span className={styles.timeSeparator}>:</span>

        {/* Minute Spinner */}
        <div className={styles.spinnerContainer}>
          <button
            type="button"
            className={styles.spinnerButton}
            onClick={incrementMinute}
          >
            <span className="material-icons">expand_less</span>
          </button>
          <input
            type="text"
            value={minute.toString().padStart(2, "0")}
            onChange={(e) => handleMinuteChange(e.target.value)}
            className={styles.timeInput}
            maxLength={2}
          />
          <button
            type="button"
            className={styles.spinnerButton}
            onClick={decrementMinute}
          >
            <span className="material-icons">expand_more</span>
          </button>
        </div>

        {/* AM/PM Toggle */}
        <button
          type="button"
          className={styles.ampmButton}
          onClick={handleAmPmToggle}
        >
          {ampm}
        </button>
      </div>
    </div>
  );
};

/**
 * Main Mobile Date Time Picker Component
 */
const MobileDateTimePicker = ({
  startDate,
  endDate,
  onStartDateChange,
  onEndDateChange,
  onConfirm,
  minDate,
  showConfirmButton = true,
}) => {
  const handleSelectDay = (date) => {
    // Preserve the time when changing the date
    const startHour = startDate ? moment(startDate).hour() : 12;
    const startMinute = startDate ? moment(startDate).minute() : 0;
    const endHour = endDate ? moment(endDate).hour() : 14;
    const endMinute = endDate ? moment(endDate).minute() : 0;

    const newStart = moment(date).hour(startHour).minute(startMinute);
    const newEnd = moment(date).hour(endHour).minute(endMinute);

    onStartDateChange(newStart);
    onEndDateChange(newEnd);
  };

  const handleStartTimeChange = ({ hour, minute }) => {
    const updated = moment(startDate || new Date());
    if (hour !== undefined) updated.hour(hour);
    if (minute !== undefined) updated.minute(minute);
    onStartDateChange(updated);
  };

  const handleEndTimeChange = ({ hour, minute }) => {
    let updated = moment(endDate || new Date());
    if (hour !== undefined) updated.hour(hour);
    if (minute !== undefined) updated.minute(minute);

    // Automatic next-day detection for overnight events
    if (startDate && updated.isBefore(moment(startDate))) {
      updated = updated.add(1, "day");
    }

    onEndDateChange(updated);
  };

  const formatSelectedDate = () => {
    if (!startDate) return "No date selected";
    return moment(startDate).format("ddd, MMM D, YYYY");
  };

  return (
    <div className={styles.container}>
      {/* Calendar */}
      <Calendar
        selectedDate={startDate}
        onSelectDay={handleSelectDay}
        minDate={minDate || new Date()}
      />

      {/* Time Section */}
      <div className={styles.timeSection}>
        <div className={styles.timeSectionHeader}>
          <span className="material-icons" style={{ fontSize: '18px', marginRight: '8px' }}>
            schedule
          </span>
          TIME
        </div>
        <div className={styles.timePickersRow}>
          <TimePicker
            label="Start time"
            value={startDate}
            onChange={handleStartTimeChange}
          />
          <TimePicker
            label="End time"
            value={endDate}
            onChange={handleEndTimeChange}
          />
        </div>
      </div>

      {/* Summary / Confirm Section */}
      {showConfirmButton && (
        <div className={styles.summarySection}>
          <div className={styles.summaryText}>
            <p className={styles.summaryLabel}>
              {startDate ? "Event date" : "No date selected"}
            </p>
            <p className={styles.summaryValue}>{formatSelectedDate()}</p>
          </div>
          <button
            type="button"
            className={styles.confirmButton}
            onClick={onConfirm}
            disabled={!startDate}
          >
            Confirm
          </button>
        </div>
      )}
    </div>
  );
};

export default MobileDateTimePicker;
