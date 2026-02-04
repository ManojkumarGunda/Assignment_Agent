import React from 'react';
import {
    DataGrid,
    GridToolbar,
    GridActionsCellItem
} from '@mui/x-data-grid';
import {
    Chip,
    Typography,
    Box,
    Tooltip
} from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import VisibilityIcon from '@mui/icons-material/Visibility';
import FilePresentIcon from '@mui/icons-material/FilePresent';
import SlideshowIcon from '@mui/icons-material/Slideshow';
import DescriptionIcon from '@mui/icons-material/Description';
import GitHubIcon from '@mui/icons-material/GitHub';

const HistoryTable = ({
    data,
    loading,
    paginationModel,
    totalRows,
    onPaginationModelChange,
    onDelete,
    onViewDetails
}) => {

    const columns = [
        {
            field: 'serial',
            headerName: 'S.No',
            width: 70,
            renderCell: (params) => {
                const rowIndex = data.findIndex(r => r.id === params.id);
                return (paginationModel.page * paginationModel.pageSize) + rowIndex + 1;
            }
        },
        {
            field: 'category',
            headerName: 'Assignment Type',
            width: 150,
            renderCell: (params) => {
                const category = params.row?.category;
                let icon = <DescriptionIcon />;
                let color = 'primary';
                let label = category || 'General';

                if (category === 'ppt') {
                    icon = <SlideshowIcon />;
                    color = 'warning';
                    label = 'PowerPoint';
                } else if (category === 'git') {
                    icon = <GitHubIcon />;
                    color = 'success';
                    label = 'GitHub';
                } else if (category === 'file_upload') {
                    icon = <FilePresentIcon />;
                    color = 'info';
                    label = 'File Upload';
                }

                return (
                    <Chip
                        icon={icon}
                        label={label}
                        size="small"
                        color={color}
                        variant="outlined"
                    />
                );
            }
        },
        {
            field: 'title',
            headerName: 'Assignment Title',
            width: 150
        },
        {
            field: 'student_name',
            headerName: 'Student Name',
            width: 150,
            renderCell: (params) => (
                <Typography variant="body2" sx={{ fontWeight: 'medium', color: 'indigo.600' }}>
                    {params.row?.student_name || 'Unknown'}
                </Typography>
            )
        },
        {
            field: 'description',
            headerName: 'Description',
            flex: 1,
            minWidth: 200,
            renderCell: (params) => (
                <Tooltip title={params.value || ''}>
                    <Typography
                        variant="body2"
                        sx={{
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                            color: 'text.secondary'
                        }}
                    >
                        {params.value || 'No description'}
                    </Typography>
                </Tooltip>
            )
        },
        {
            field: 'score',
            headerName: 'Score',
            width: 100,
            renderCell: (params) => {
                const score = params.value || 0;
                let color = 'error';
                if (score >= 80) color = 'success';
                else if (score >= 50) color = 'warning';

                return (
                    <Box sx={{ fontWeight: 'bold', color: `${color}.main` }}>
                        {score}%
                    </Box>
                );
            }
        },
        {
            field: 'created_at',
            headerName: 'Date',
            width: 180,
            renderCell: (params) => {
                const dateStr = params.row?.created_at;
                if (!dateStr || dateStr === 'N/A') return 'N/A';

                try {
                    const date = new Date(dateStr);
                    // Check if date is valid
                    if (isNaN(date.getTime())) return dateStr;

                    // Format to local string
                    return (
                        <Typography variant="body2" color="text.secondary">
                            {date.toLocaleString()}
                        </Typography>
                    );
                } catch (e) {
                    return dateStr;
                }
            }
        },
        {
            field: 'actions',
            type: 'actions',
            headerName: 'Actions',
            width: 150,
            getActions: (params) => [
                <GridActionsCellItem
                    key={`view-${params.id}`}
                    icon={<VisibilityIcon />}
                    label="View Details"
                    onClick={() => onViewDetails(params.row)}
                />,
                <GridActionsCellItem
                    key={`delete-${params.id}`}
                    icon={<DeleteIcon />}
                    label="Delete"
                    onClick={() => onDelete(params.row.id)}
                    color="error"
                />,
            ],
        },
    ];

    return (
        <Box sx={{ height: 600, width: '100%', bgcolor: 'white', borderRadius: 2, p: 2, boxShadow: 3 }}>
            <DataGrid
                rows={data}
                columns={columns}
                loading={loading}
                paginationMode="server"
                rowCount={totalRows}
                pageSizeOptions={[5, 10, 25]}
                paginationModel={paginationModel}
                onPaginationModelChange={onPaginationModelChange}

                /* 🔒 HIDDEN COLUMNS */
                columnVisibilityModel={{
                    student_name: false,
                    score: false,
                }}

                slots={{ toolbar: GridToolbar }}
                slotProps={{
                    toolbar: {
                        showQuickFilter: true,
                        quickFilterProps: { debounceMs: 500 },
                    },
                }}
                disableRowSelectionOnClick
                sx={{
                    border: 'none',
                    '& .MuiDataGrid-cell:focus': { outline: 'none' },
                    '& .MuiDataGrid-columnHeaders': {
                        bgcolor: '#f8fafc',
                        color: '#475569',
                        fontWeight: 'bold',
                    }
                }}
            />
        </Box>
    );
};

export default HistoryTable;
