import React, { useState, useEffect } from 'react';
import styles from './EventEdit.module.css';
import {
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
} from '@mui/material';
import VisibilityIcon from '@mui/icons-material/Visibility';
import DownloadIcon from '@mui/icons-material/Download';
import axios from 'axios';
import { toast } from 'react-toastify';

const RSVPSubmissionsView = ({ eventId, businessId }) => {
  const [submissions, setSubmissions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedSubmission, setSelectedSubmission] = useState(null);
  const [openDialog, setOpenDialog] = useState(false);

  useEffect(() => {
    fetchSubmissions();
  }, [eventId]);

  const fetchSubmissions = async () => {
    try {
      setLoading(true);
      const response = await axios.get(`/event/rsvp-submissions?eventId=${eventId}`, {
        headers: {
          Authorization: `Bearer ${localStorage.getItem('idToken')}`,
        },
      });
      if (response.data?.submissions) {
        setSubmissions(response.data.submissions);
      }
    } catch (error) {
      console.error('Error fetching submissions:', error);
      toast.error('Failed to load RSVP submissions');
    } finally {
      setLoading(false);
    }
  };

  const handleViewDetails = (submission) => {
    setSelectedSubmission(submission);
    setOpenDialog(true);
  };

  const handleCloseDialog = () => {
    setOpenDialog(false);
    setSelectedSubmission(null);
  };

  const handleExportCSV = () => {
    if (submissions.length === 0) {
      toast.error('No submissions to export');
      return;
    }

    // Get all unique field names
    const allFields = new Set();
    submissions.forEach(sub => {
      Object.keys(sub.formData || {}).forEach(field => allFields.add(field));
    });

    // Create CSV header
    const headers = ['Name', 'Email', 'Submitted At', ...Array.from(allFields)];
    const csvContent = [
      headers.join(','),
      ...submissions.map(sub => {
        const row = [
          sub.userName || '',
          sub.userEmail || '',
          new Date(sub.submittedAt).toLocaleString(),
          ...Array.from(allFields).map(field => {
            const value = sub.formData?.[field] || '';
            // Escape quotes in CSV
            return `"${String(value).replace(/"/g, '""')}"`;
          }),
        ];
        return row.join(',');
      }),
    ].join('\n');

    // Download CSV
    const element = document.createElement('a');
    element.setAttribute('href', `data:text/csv;charset=utf-8,${encodeURIComponent(csvContent)}`);
    element.setAttribute('download', `rsvp-submissions-${eventId}.csv`);
    element.style.display = 'none';
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);

    toast.success('Submissions exported successfully');
  };

  if (loading) {
    return <div style={{ padding: '20px' }}>Loading RSVP submissions...</div>;
  }

  return (
    <div style={{ padding: '20px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <h2>RSVP Submissions ({submissions.length})</h2>
        <Button
          startIcon={<DownloadIcon />}
          onClick={handleExportCSV}
          variant="outlined"
        >
          Export CSV
        </Button>
      </div>

      {submissions.length === 0 ? (
        <p style={{ color: '#999' }}>No RSVP submissions yet</p>
      ) : (
        <TableContainer component={Paper}>
          <Table>
            <TableHead>
              <TableRow style={{ backgroundColor: '#f5f5f5' }}>
                <TableCell>Name</TableCell>
                <TableCell>Email</TableCell>
                <TableCell>Submitted At</TableCell>
                <TableCell align="center">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {submissions.map((submission, index) => (
                <TableRow key={index}>
                  <TableCell>{submission.userName}</TableCell>
                  <TableCell>{submission.userEmail}</TableCell>
                  <TableCell>
                    {new Date(submission.submittedAt).toLocaleString()}
                  </TableCell>
                  <TableCell align="center">
                    <IconButton
                      size="small"
                      onClick={() => handleViewDetails(submission)}
                      title="View Details"
                    >
                      <VisibilityIcon />
                    </IconButton>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      <Dialog open={openDialog} onClose={handleCloseDialog} maxWidth="sm" fullWidth>
        <DialogTitle>RSVP Details</DialogTitle>
        <DialogContent>
          {selectedSubmission && (
            <div style={{ marginTop: '20px' }}>
              <p>
                <strong>Name:</strong> {selectedSubmission.userName}
              </p>
              <p>
                <strong>Email:</strong> {selectedSubmission.userEmail}
              </p>
              <p>
                <strong>Submitted:</strong>{' '}
                {new Date(selectedSubmission.submittedAt).toLocaleString()}
              </p>
              <hr />
              <h4>Form Data</h4>
              {Object.entries(selectedSubmission.formData || {}).map(([key, value]) => (
                <p key={key}>
                  <strong>{key.replace(/([A-Z])/g, ' $1').trim()}:</strong> {value}
                </p>
              ))}
            </div>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseDialog}>Close</Button>
        </DialogActions>
      </Dialog>
    </div>
  );
};

export default RSVPSubmissionsView;
