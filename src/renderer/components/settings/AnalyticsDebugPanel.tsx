import React, { useState } from 'react';
import {
  Box,
  Typography,
  Button,
  TextField,
  Paper,
  List,
  ListItem,
  ListItemText,
  Divider
} from '@mui/material';

interface LogEntry {
  timestamp: string;
  message: string;
  success: boolean;
  details?: {
    status?: number;
    statusText?: string;
    clientId?: string;
    sessionId?: string;
    serverResponse?: any;
    responseHeaders?: any;
    error?: {
      message?: string;
      code?: string;
      response?: any;
      status?: number;
      statusText?: string;
    };
  };
}

export const AnalyticsDebugPanel: React.FC = () => {
  const [category, setCategory] = useState('Test');
  const [action, setAction] = useState('Debug');
  const [label, setLabel] = useState('');
  const [logs, setLogs] = useState<LogEntry[]>([]);

  const addLog = (message: string, success: boolean, details?: LogEntry['details']) => {
    setLogs(prev => [{
      timestamp: new Date().toISOString(),
      message,
      success,
      details
    }, ...prev]);
  };

  const handleTestEvent = async () => {
    try {
      const result = await window.electron.analytics.testEvent({ category, action, label });
      addLog(result.message, result.success, {
        status: result.status,
        statusText: result.statusText,
        clientId: result.clientId,
        sessionId: result.sessionId
      });

      const status = await window.electron.analytics.getStatus();
      if (status.lastEvent?.response) {
        addLog('Analytics status received', status.success, status.lastEvent.response);
      } else {
        addLog(`Analytics status: ${JSON.stringify(status)}`, status.success);
      }
    } catch (error: any) {
      addLog(`Error: ${error.message}`, false);
    }
  };

  const formatResponse = (data: any) => {
    if (!data) return 'No data';
    try {
      return JSON.stringify(data, null, 2);
    } catch (e) {
      return String(data);
    }
  };

  return (
    <Box>
      <Typography variant="h6" sx={{ mb: 2 }}>Analytics Debug Panel</Typography>

      <Box sx={{ mb: 3 }}>
        <TextField
          label="Category"
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          fullWidth
          margin="normal"
          size="small"
        />
        <TextField
          label="Action"
          value={action}
          onChange={(e) => setAction(e.target.value)}
          fullWidth
          margin="normal"
          size="small"
        />
        <TextField
          label="Label (optional)"
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          fullWidth
          margin="normal"
          size="small"
        />
        <Button
          variant="contained"
          onClick={handleTestEvent}
          sx={{ mt: 2 }}
        >
          Test Analytics Event
        </Button>
      </Box>

      <Typography variant="subtitle1" sx={{ mb: 1 }}>Debug Logs</Typography>
      <Paper variant="outlined" sx={{ maxHeight: 400, overflow: 'auto' }}>
        <List dense>
          {logs.map((log, index) => (
            <React.Fragment key={index}>
              <ListItem>
                <ListItemText
                  primary={log.message}
                  secondary={
                    <Box>
                      <Typography variant="caption" component="div">
                        {log.timestamp}
                      </Typography>
                      {log.details && (
                        <Box sx={{ mt: 1, fontSize: '0.875rem' }}>
                          {log.details.status && (
                            <Box>Status: {log.details.status} {log.details.statusText}</Box>
                          )}
                          {log.details.clientId && (
                            <Box>Client ID: {log.details.clientId}</Box>
                          )}
                          {log.details.sessionId && (
                            <Box>Session ID: {log.details.sessionId}</Box>
                          )}
                          {log.details.serverResponse && (
                            <Box>
                              <Typography variant="caption" color="text.secondary">Server Response:</Typography>
                              <pre style={{
                                margin: '4px 0',
                                padding: '8px',
                                background: 'rgba(0,0,0,0.04)',
                                borderRadius: '4px',
                                overflowX: 'auto',
                                fontSize: '0.75rem'
                              }}>
                                {formatResponse(log.details.serverResponse)}
                              </pre>
                            </Box>
                          )}
                          {log.details.responseHeaders && (
                            <Box>
                              <Typography variant="caption" color="text.secondary">Response Headers:</Typography>
                              <pre style={{
                                margin: '4px 0',
                                padding: '8px',
                                background: 'rgba(0,0,0,0.04)',
                                borderRadius: '4px',
                                overflowX: 'auto',
                                fontSize: '0.75rem'
                              }}>
                                {formatResponse(log.details.responseHeaders)}
                              </pre>
                            </Box>
                          )}
                          {log.details.error && (
                            <Box sx={{ color: 'error.main' }}>
                              <Typography variant="caption">Error Details:</Typography>
                              <pre style={{
                                margin: '4px 0',
                                padding: '8px',
                                background: 'rgba(255,0,0,0.04)',
                                borderRadius: '4px',
                                overflowX: 'auto',
                                fontSize: '0.75rem'
                              }}>
                                {formatResponse(log.details.error)}
                              </pre>
                            </Box>
                          )}
                        </Box>
                      )}
                    </Box>
                  }
                  sx={{
                    color: log.success ? 'success.main' : 'error.main',
                    '& .MuiTypography-root': {
                      whiteSpace: 'normal',
                      wordBreak: 'break-word'
                    }
                  }}
                />
              </ListItem>
              {index < logs.length - 1 && <Divider />}
            </React.Fragment>
          ))}
        </List>
      </Paper>
    </Box>
  );
};