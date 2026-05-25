import React, { useState, useEffect } from 'react';
import styles from './EventEdit.module.css';
import { toast } from 'react-toastify';
import axios from 'axios';
import { Button, TextField, Checkbox, FormControlLabel, IconButton } from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import AddIcon from '@mui/icons-material/Add';

const RSVPFormEditor = ({ eventId, businessId }) => {
  const [form, setForm] = useState({
    formTitle: 'Event RSVP',
    requiredFields: ['fullName', 'phone', 'email'],
    optionalFields: [],
    customFields: [],
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const availableOptionalFields = [
    { value: 'age', label: 'Age' },
    { value: 'numberOfGuests', label: 'Number of Guests' },
    { value: 'address', label: 'Address' },
    { value: 'comments', label: 'Comments' },
  ];

  useEffect(() => {
    fetchRSVPForm();
  }, [eventId]);

  const fetchRSVPForm = async () => {
    try {
      setLoading(true);
      const response = await axios.get(`/event/rsvp-form?eventId=${eventId}`);
      if (response.data?.form) {
        setForm(response.data.form);
      }
    } catch (error) {
      console.error('Error fetching RSVP form:', error);
      toast.error('Failed to load RSVP form');
    } finally {
      setLoading(false);
    }
  };

  const handleFormTitleChange = (e) => {
    setForm(prev => ({
      ...prev,
      formTitle: e.target.value,
    }));
  };

  const handleOptionalFieldToggle = (fieldValue) => {
    setForm(prev => {
      const optionalFields = prev.optionalFields.includes(fieldValue)
        ? prev.optionalFields.filter(f => f !== fieldValue)
        : [...prev.optionalFields, fieldValue];
      return { ...prev, optionalFields };
    });
  };

  const handleAddCustomField = () => {
    setForm(prev => ({
      ...prev,
      customFields: [
        ...prev.customFields,
        { name: '', type: 'text', required: false },
      ],
    }));
  };

  const handleCustomFieldChange = (index, field, value) => {
    setForm(prev => {
      const customFields = [...prev.customFields];
      customFields[index] = { ...customFields[index], [field]: value };
      return { ...prev, customFields };
    });
  };

  const handleRemoveCustomField = (index) => {
    setForm(prev => ({
      ...prev,
      customFields: prev.customFields.filter((_, i) => i !== index),
    }));
  };

  const handleSave = async () => {
    if (!form.formTitle.trim()) {
      toast.error('Form title is required');
      return;
    }

    // Validate custom fields
    for (const field of form.customFields) {
      if (!field.name.trim()) {
        toast.error('All custom fields must have a name');
        return;
      }
    }

    try {
      setSaving(true);
      await axios.post('/event/rsvp-form', {
        eventId,
        businessId,
        formTitle: form.formTitle,
        requiredFields: form.requiredFields,
        optionalFields: form.optionalFields,
        customFields: form.customFields,
      }, {
        headers: {
          Authorization: `Bearer ${localStorage.getItem('idToken')}`,
        },
      });
      toast.success('RSVP form saved successfully');
    } catch (error) {
      console.error('Error saving RSVP form:', error);
      toast.error('Failed to save RSVP form');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div style={{ padding: '20px' }}>Loading RSVP form...</div>;
  }

  return (
    <div style={{ padding: '20px', maxWidth: '800px' }}>
      <h2>RSVP Form Configuration</h2>

      <div style={{ marginBottom: '20px' }}>
        <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold' }}>
          Form Title
        </label>
        <TextField
          fullWidth
          value={form.formTitle}
          onChange={handleFormTitleChange}
          placeholder="e.g., Event RSVP"
          variant="outlined"
          size="small"
        />
      </div>

      <div style={{ marginBottom: '20px' }}>
        <h3>Required Fields</h3>
        <p style={{ color: '#666', fontSize: '14px' }}>
          These fields are always required:
        </p>
        <ul style={{ marginLeft: '20px' }}>
          <li>Full Name</li>
          <li>Phone Number</li>
          <li>Email</li>
        </ul>
      </div>

      <div style={{ marginBottom: '20px' }}>
        <h3>Optional Fields</h3>
        <p style={{ color: '#666', fontSize: '14px' }}>
          Select which optional fields to include:
        </p>
        {availableOptionalFields.map(field => (
          <FormControlLabel
            key={field.value}
            control={
              <Checkbox
                checked={form.optionalFields.includes(field.value)}
                onChange={() => handleOptionalFieldToggle(field.value)}
              />
            }
            label={field.label}
          />
        ))}
      </div>

      <div style={{ marginBottom: '20px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
          <h3>Custom Fields</h3>
          <Button
            startIcon={<AddIcon />}
            onClick={handleAddCustomField}
            variant="outlined"
            size="small"
          >
            Add Field
          </Button>
        </div>
        {form.customFields.length === 0 ? (
          <p style={{ color: '#999', fontSize: '14px' }}>No custom fields added yet</p>
        ) : (
          form.customFields.map((field, index) => (
            <div key={index} style={{ marginBottom: '15px', padding: '10px', border: '1px solid #ddd', borderRadius: '4px' }}>
              <div style={{ display: 'flex', gap: '10px', marginBottom: '10px' }}>
                <TextField
                  label="Field Name"
                  value={field.name}
                  onChange={(e) => handleCustomFieldChange(index, 'name', e.target.value)}
                  placeholder="e.g., Dietary Restrictions"
                  size="small"
                  style={{ flex: 1 }}
                />
                <TextField
                  label="Field Type"
                  select
                  value={field.type}
                  onChange={(e) => handleCustomFieldChange(index, 'type', e.target.value)}
                  size="small"
                  style={{ width: '150px' }}
                  SelectProps={{
                    native: true,
                  }}
                >
                  <option value="text">Text</option>
                  <option value="textarea">Textarea</option>
                  <option value="number">Number</option>
                  <option value="email">Email</option>
                </TextField>
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={field.required}
                      onChange={(e) => handleCustomFieldChange(index, 'required', e.target.checked)}
                    />
                  }
                  label="Required"
                />
                <IconButton
                  onClick={() => handleRemoveCustomField(index)}
                  size="small"
                  color="error"
                >
                  <DeleteIcon />
                </IconButton>
              </div>
            </div>
          ))
        )}
      </div>

      <Button
        onClick={handleSave}
        disabled={saving}
        variant="contained"
        color="primary"
        fullWidth
      >
        {saving ? 'Saving...' : 'Save RSVP Form'}
      </Button>
    </div>
  );
};

export default RSVPFormEditor;
