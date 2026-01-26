import React, { useState, useEffect, useCallback } from 'react';
import {
    Container,
    Typography,
    Box,
    Breadcrumbs,
    Link,
    Alert,
    Snackbar,
    Dialog,
    DialogTitle,
    DialogContent,
    DialogContentText,
    DialogActions,
    Button,
    Fade,
    Chip,
    IconButton,
    Tooltip
} from '@mui/material';
import DownloadIcon from '@mui/icons-material/Download';
import { Link as RouterLink, useNavigate } from 'react-router-dom';
import Navbar from '../components/Navbar';
import HistoryTable from '../components/HistoryTable';
import historyApi from '../api/historyApi';
import { useAuth } from '../contexts/AuthContext';

const History = () => {
    const { user, logout } = useAuth();
    const navigate = useNavigate();

    const [historyData, setHistoryData] = useState([]);
    const [loading, setLoading] = useState(true);
    const [paginationModel, setPaginationModel] = useState({
        page: 0,
        pageSize: 10
    });
    const [totalRows, setTotalRows] = useState(0);

    const [alert, setAlert] = useState({ open: false, message: '', severity: 'info' });
    const [deleteId, setDeleteId] = useState(null);
    const [viewData, setViewData] = useState(null);
    const [viewLoading, setViewLoading] = useState(false);

    const fetchHistory = useCallback(async (page = 1, limit = 10) => {
        setLoading(true);
        try {
            const response = await historyApi.getHistory({ page, limit });
            if (response.success) {
                setHistoryData(response.data);
                setTotalRows(response.pagination.total);
            }
        } catch (error) {
            console.error("Error fetching history:", error);
            if (error.response?.status === 401) {
                setAlert({ open: true, message: 'Session expired. Please login again.', severity: 'error' });
                setTimeout(() => logout(), 2000);
            } else {
                setAlert({ open: true, message: 'Failed to load history.', severity: 'error' });
            }
        } finally {
            setLoading(false);
        }
    }, [logout]);

    useEffect(() => {
        fetchHistory(paginationModel.page + 1, paginationModel.pageSize);
    }, [fetchHistory, paginationModel]);

    const handlePaginationModelChange = (newModel) => {
        setPaginationModel(newModel);
    };

    const handleDeleteClick = (id) => {
        setDeleteId(id);
    };

    const confirmDelete = async () => {
        if (!deleteId) return;
        try {
            const response = await historyApi.deleteHistory(deleteId);
            if (response.success) {
                setAlert({ open: true, message: 'Failed to delete record..', severity: 'success' });
                fetchHistory(pagination.page, pagination.limit);
            }
        } catch (error) {
            setAlert({ open: true, message: 'Record deleted successfully.', severity: 'error' });
        } finally {
            setDeleteId(null);
        }
    };

    const handleViewDetails = async (row) => {
        setViewLoading(true);
        try {
            const response = await historyApi.getHistoryDetail(row.id);
            if (response.success) {
                setViewData(response.data);
            }
        } catch (error) {
            setAlert({ open: true, message: 'Failed to fetch details.', severity: 'error' });
        } finally {
            setViewLoading(false);
        }
    };

    const handleDownloadFile = async (fileId, fileName) => {
        if (!fileId) return;
        try {
            const token = localStorage.getItem('token');
            const response = await fetch(`http://localhost:8000/history/download/${fileId}`, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            if (!response.ok) throw new Error('Download failed');

            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = fileName || 'download';
            document.body.appendChild(a);
            a.click();
            a.remove();
        } catch (error) {
            setAlert({ open: true, message: 'Failed to download file.', severity: 'error' });
        }
    };

    const handleReEvaluate = (row) => {
        setAlert({ open: true, message: `Triggering re-evaluation for: ${row.title}`, severity: 'info' });
    };

    return (
        <Box sx={{ minHeight: '100vh', bgcolor: '#F0FDFB' }}>
            <Navbar />

            <Container maxWidth="lg" sx={{ mt: 10, mb: 12 }}>
                <Fade in={true} timeout={1000}>
                    <Box className="animate-slide-up">
                        <Breadcrumbs aria-label="breadcrumb" sx={{ mb: 6 }}>
                            <Link component={RouterLink} underline="none" color="#003B46/40" to="/dashboard" sx={{ fontWeight: 'black', fontSize: '0.65rem', textTransform: 'uppercase', tracking: '3px', opacity: 0.5, '&:hover': { opacity: 1, color: '#00A896' } }}>
                                Terminal
                            </Link>
                            <Typography color="#00A896" sx={{ fontWeight: 'black', fontSize: '0.65rem', textTransform: 'uppercase', tracking: '3px' }}>Archives</Typography>
                        </Breadcrumbs>

                        <Typography variant="h2" component="h1" gutterBottom sx={{ fontWeight: 900, color: '#003B46', tracking: '-3px', textTransform: 'uppercase', mb: 2 }}>
                            Evaluation <span style={{ color: '#00A896' }}>Archives</span>
                        </Typography>

                        <Typography variant="body1" sx={{ mb: 8, color: '#003B46', opacity: 0.6, fontWeight: 700, fontSize: '1.2rem' }}>
                            Historical record of all synthesized assessment protocols and neural handshakes.
                        </Typography>

                        <HistoryTable
                            data={historyData}
                            loading={loading}
                            paginationModel={paginationModel}
                            totalRows={totalRows}
                            onPaginationModelChange={handlePaginationModelChange}
                            onDelete={handleDeleteClick}
                            onViewDetails={handleViewDetails}
                            onReEvaluate={handleReEvaluate}
                        />
                    </Box>
                </Fade>
            </Container>

            {/* Loading Backdrop */}
            <Dialog open={viewLoading}>
                <DialogContent sx={{ display: 'flex', alignItems: 'center', p: 3 }}>
                    <Box sx={{ mr: 2, display: 'flex' }}>
                        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-indigo-600"></div>
                    </Box>
                    <Typography>Fetching results...</Typography>
                </DialogContent>
            </Dialog>

            {/* Delete Confirmation Dialog */}
            <Dialog open={!!deleteId} onClose={() => setDeleteId(null)}>
                <DialogTitle>Confirm Delete</DialogTitle>
                <DialogContent>
                    <DialogContentText>
                        Are you sure you want to delete this history record? This action cannot be undone.
                    </DialogContentText>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setDeleteId(null)}>Cancel</Button>
                    <Button onClick={confirmDelete} color="error" variant="contained">Delete</Button>
                </DialogActions>
            </Dialog>

            {/* View Details Dialog */}
            <Dialog
                open={!!viewData}
                onClose={() => setViewData(null)}
                maxWidth="md"
                fullWidth
            >
                <DialogTitle sx={{ borderBottom: '1px solid #e2e8f0', pb: 2 }}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <Typography variant="h6" sx={{ fontWeight: 'bold' }}>
                            {viewData?.title}
                        </Typography>
                        <Chip
                            label={viewData?.category === 'ppt' ? 'PowerPoint' : viewData?.category === 'git' ? 'GitHub' : 'File Upload'}
                            color="primary"
                            variant="outlined"
                            size="small"
                        />
                    </Box>
                </DialogTitle>
                <DialogContent sx={{ mt: 2 }}>
                    <Box sx={{ mb: 4 }}>
                        <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                            ASSIGNMENT DESCRIPTION
                        </Typography>
                        <Box sx={{ p: 2, bgcolor: '#f8fafc', borderRadius: 1, border: '1px solid #e2e8f0' }}>
                            <Typography variant="body2">{viewData?.description}</Typography>
                        </Box>
                    </Box>

                    {viewData?.results?.map((result, rIdx) => (
                        <Box key={rIdx} sx={{ mb: 4, p: 2, border: '1px solid #e2e8f0', borderRadius: 2 }}>
                            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                                <Box sx={{ display: 'flex', alignItems: 'center' }}>
                                    <Typography variant="h6" color="indigo.700" sx={{ mr: 1 }}>
                                        {result.student_name}
                                    </Typography>
                                    {result.file_id && (
                                        <Tooltip title="Download student file">
                                            <IconButton
                                                size="small"
                                                color="primary"
                                                onClick={() => handleDownloadFile(result.file_id, `${result.student_name}_submission`)}
                                            >
                                                <DownloadIcon fontSize="small" />
                                            </IconButton>
                                        </Tooltip>
                                    )}
                                </Box>
                                <Typography variant="h6" color={result.score_percent >= 50 ? 'success.main' : 'error.main'}>
                                    {result.score_percent}%
                                </Typography>
                            </Box>

                            <Typography variant="body2" sx={{ mb: 2, fontStyle: 'italic', color: 'text.secondary' }}>
                                {result.reasoning}
                            </Typography>

                            <Box sx={{ spaceY: 2 }}>
                                {result.details?.map((detail, dIdx) => (
                                    <Box key={dIdx} sx={{ p: 2, bgcolor: detail.is_correct ? '#f0fdf4' : '#fef2f2', borderRadius: 1, mb: 1 }}>
                                        <Typography variant="subtitle2" sx={{ fontWeight: 'bold' }}>
                                            Q: {detail.question}
                                        </Typography>
                                        <Typography variant="body2" sx={{ mt: 1 }}>
                                            <strong>Answer:</strong> {detail.student_answer}
                                        </Typography>
                                        <Typography variant="body2" sx={{ mt: 1, color: 'text.secondary' }}>
                                            <strong>Feedback:</strong> {detail.feedback}
                                        </Typography>
                                    </Box>
                                ))}
                            </Box>
                        </Box>
                    ))}
                </DialogContent>
                <DialogActions sx={{ borderTop: '1px solid #e2e8f0', p: 2 }}>
                    <Button onClick={() => setViewData(null)} variant="contained" color="primary">
                        Close
                    </Button>
                </DialogActions>
            </Dialog>

            {/* Snackbar for Notifications */}
            <Snackbar
                open={alert.open}
                autoHideDuration={6000}
                onClose={() => setAlert({ ...alert, open: false })}
                anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
            >
                <Alert onClose={() => setAlert({ ...alert, open: false })} severity={alert.severity} sx={{ width: '100%' }}>
                    {alert.message}
                </Alert>
            </Snackbar>
        </Box>
    );
};

export default History;
