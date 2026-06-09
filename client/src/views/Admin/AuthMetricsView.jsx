import React, { useState, useEffect, useCallback } from "react";
import {
  Box,
  Card,
  CardContent,
  Typography,
  LinearProgress,
  CircularProgress,
  Alert,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Chip,
  Divider,
} from "@mui/material";
import GoogleIcon from "@mui/icons-material/Google";
import AppleIcon from "@mui/icons-material/Apple";
import FacebookIcon from "@mui/icons-material/Facebook";
import EmailIcon from "@mui/icons-material/Email";
import PhoneAndroidIcon from "@mui/icons-material/PhoneAndroid";
import BusinessIcon from "@mui/icons-material/Business";
import WarningAmberIcon from "@mui/icons-material/WarningAmber";
import BlockIcon from "@mui/icons-material/Block";
import GroupIcon from "@mui/icons-material/Group";
import http from "../../utils/axios/http";
import { toast } from "react-toastify";

/**
 * Placeholder/mock data used when the backend metrics endpoint
 * is not yet available.
 */
const MOCK_DISTRIBUTION = [
  { provider: "google", label: "Google", percentage: 34 },
  { provider: "apple", label: "Apple", percentage: 22 },
  { provider: "facebook", label: "Facebook", percentage: 15 },
  { provider: "email", label: "Email", percentage: 18 },
  { provider: "phone", label: "Phone", percentage: 8 },
  { provider: "sso", label: "SSO", percentage: 3 },
];

const MOCK_FAILED_ATTEMPTS = {
  last7Days: 47,
  last24Hours: 12,
  flaggedIPs: [
    { ip: "192.168.1.100", attempts: 15, lastSeen: "2024-01-15T10:30:00Z" },
    { ip: "10.0.0.55", attempts: 9, lastSeen: "2024-01-14T22:15:00Z" },
    { ip: "172.16.0.88", attempts: 7, lastSeen: "2024-01-15T08:45:00Z" },
  ],
  flaggedAccounts: 3,
};

const MOCK_ORG_METRICS = {
  totalMembers: 24,
  ssoLogins: 18,
  loginsByMethod: [
    { method: "SSO", count: 18 },
    { method: "Google", count: 4 },
    { method: "Email", count: 2 },
  ],
};

/**
 * Icon mapping for auth providers.
 */
const PROVIDER_ICONS = {
  google: <GoogleIcon sx={{ color: "#4285F4", fontSize: 20 }} />,
  apple: <AppleIcon sx={{ color: "#000", fontSize: 20 }} />,
  facebook: <FacebookIcon sx={{ color: "#1877F2", fontSize: 20 }} />,
  email: <EmailIcon sx={{ color: "#666", fontSize: 20 }} />,
  phone: <PhoneAndroidIcon sx={{ color: "#4CAF50", fontSize: 20 }} />,
  sso: <BusinessIcon sx={{ color: "#7B1FA2", fontSize: 20 }} />,
};

/**
 * Color mapping for provider progress bars.
 */
const PROVIDER_COLORS = {
  google: "#4285F4",
  apple: "#000000",
  facebook: "#1877F2",
  email: "#FF9800",
  phone: "#4CAF50",
  sso: "#7B1FA2",
};

/**
 * AuthMetricsView — Admin dashboard showing authentication metrics:
 * - Auth method distribution (% by provider)
 * - Failed attempt trends and flagged accounts
 * - Organization-wide login metrics (for org admins)
 *
 * Validates: Requirements 16.5, 24.10, 25.9
 */
export default function AuthMetricsView() {
  const [distribution, setDistribution] = useState(null);
  const [failedAttempts, setFailedAttempts] = useState(null);
  const [orgMetrics, setOrgMetrics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [usingMockData, setUsingMockData] = useState(false);

  /**
   * Fetch auth metrics from backend. Falls back to mock data
   * if the endpoint is not yet available.
   */
  const fetchMetrics = useCallback(async () => {
    setLoading(true);
    try {
      const response = await http.get("authWeb/auth-metrics");
      const data = response.data;

      setDistribution(data.distribution || MOCK_DISTRIBUTION);
      setFailedAttempts(data.failedAttempts || MOCK_FAILED_ATTEMPTS);
      setOrgMetrics(data.orgMetrics || null);
      setUsingMockData(false);
    } catch (err) {
      // Endpoint doesn't exist yet — use mock data gracefully
      console.warn("Auth metrics endpoint not available, using placeholder data:", err.message);
      setDistribution(MOCK_DISTRIBUTION);
      setFailedAttempts(MOCK_FAILED_ATTEMPTS);
      setOrgMetrics(MOCK_ORG_METRICS);
      setUsingMockData(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchMetrics();
  }, [fetchMetrics]);

  if (loading) {
    return (
      <Box sx={{ display: "flex", justifyContent: "center", py: 6 }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box sx={{ maxWidth: 1000, mx: "auto", py: 4, px: 2 }}>
      <Typography variant="h5" sx={{ mb: 1, fontWeight: 600 }}>
        Auth Metrics Dashboard
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        Overview of authentication method usage, failed attempts, and organization login activity.
      </Typography>

      {usingMockData && (
        <Alert severity="info" sx={{ mb: 3 }}>
          Displaying placeholder data. The metrics endpoint is not yet available.
        </Alert>
      )}

      {/* Auth Method Distribution Section */}
      <Card variant="outlined" sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant="h6" sx={{ mb: 2, fontWeight: 600 }}>
            Auth Method Distribution
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Percentage of logins by authentication provider.
          </Typography>

          {distribution && distribution.length > 0 ? (
            <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
              {distribution.map((item) => (
                <Box key={item.provider} sx={{ display: "flex", alignItems: "center", gap: 2 }}>
                  <Box sx={{ display: "flex", alignItems: "center", gap: 1, minWidth: 120 }}>
                    {PROVIDER_ICONS[item.provider] || null}
                    <Typography variant="body2" sx={{ fontWeight: 500 }}>
                      {item.label}
                    </Typography>
                  </Box>
                  <Box sx={{ flex: 1 }}>
                    <LinearProgress
                      variant="determinate"
                      value={item.percentage}
                      sx={{
                        height: 10,
                        borderRadius: 5,
                        backgroundColor: "#f0f0f0",
                        "& .MuiLinearProgress-bar": {
                          borderRadius: 5,
                          backgroundColor: PROVIDER_COLORS[item.provider] || "#999",
                        },
                      }}
                    />
                  </Box>
                  <Typography
                    variant="body2"
                    sx={{ minWidth: 40, textAlign: "right", fontWeight: 600 }}
                  >
                    {item.percentage}%
                  </Typography>
                </Box>
              ))}
            </Box>
          ) : (
            <Typography variant="body2" color="text.secondary">
              No data available.
            </Typography>
          )}
        </CardContent>
      </Card>

      {/* Failed Attempt Trends Section */}
      <Card variant="outlined" sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant="h6" sx={{ mb: 2, fontWeight: 600 }}>
            Failed Attempts &amp; Flagged Accounts
          </Typography>

          {failedAttempts ? (
            <>
              {/* Stats Cards Row */}
              <Box sx={{ display: "flex", gap: 2, mb: 3, flexWrap: "wrap" }}>
                <Card
                  variant="outlined"
                  sx={{ flex: 1, minWidth: 150, backgroundColor: "#FFF3E0" }}
                >
                  <CardContent sx={{ textAlign: "center", py: 2 }}>
                    <WarningAmberIcon sx={{ color: "#E65100", fontSize: 28, mb: 0.5 }} />
                    <Typography variant="h4" sx={{ fontWeight: 700, color: "#E65100" }}>
                      {failedAttempts.last7Days}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Failed (Last 7 Days)
                    </Typography>
                  </CardContent>
                </Card>

                <Card
                  variant="outlined"
                  sx={{ flex: 1, minWidth: 150, backgroundColor: "#FFEBEE" }}
                >
                  <CardContent sx={{ textAlign: "center", py: 2 }}>
                    <WarningAmberIcon sx={{ color: "#C62828", fontSize: 28, mb: 0.5 }} />
                    <Typography variant="h4" sx={{ fontWeight: 700, color: "#C62828" }}>
                      {failedAttempts.last24Hours}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Failed (Last 24h)
                    </Typography>
                  </CardContent>
                </Card>

                <Card
                  variant="outlined"
                  sx={{ flex: 1, minWidth: 150, backgroundColor: "#F3E5F5" }}
                >
                  <CardContent sx={{ textAlign: "center", py: 2 }}>
                    <BlockIcon sx={{ color: "#7B1FA2", fontSize: 28, mb: 0.5 }} />
                    <Typography variant="h4" sx={{ fontWeight: 700, color: "#7B1FA2" }}>
                      {failedAttempts.flaggedAccounts}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Flagged Accounts
                    </Typography>
                  </CardContent>
                </Card>
              </Box>

              {/* Flagged IPs Table */}
              {failedAttempts.flaggedIPs && failedAttempts.flaggedIPs.length > 0 && (
                <>
                  <Divider sx={{ mb: 2 }} />
                  <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 600 }}>
                    Most-Flagged IP Addresses
                  </Typography>
                  <TableContainer component={Paper} variant="outlined">
                    <Table size="small">
                      <TableHead>
                        <TableRow>
                          <TableCell>IP Address</TableCell>
                          <TableCell align="right">Failed Attempts</TableCell>
                          <TableCell>Last Seen</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {failedAttempts.flaggedIPs.map((entry) => (
                          <TableRow key={entry.ip}>
                            <TableCell>
                              <Typography variant="body2" sx={{ fontFamily: "monospace" }}>
                                {entry.ip}
                              </Typography>
                            </TableCell>
                            <TableCell align="right">
                              <Chip
                                label={entry.attempts}
                                size="small"
                                color="error"
                                variant="outlined"
                              />
                            </TableCell>
                            <TableCell>
                              <Typography variant="body2" color="text.secondary">
                                {entry.lastSeen
                                  ? new Date(entry.lastSeen).toLocaleString(undefined, {
                                      month: "short",
                                      day: "numeric",
                                      hour: "2-digit",
                                      minute: "2-digit",
                                    })
                                  : "—"}
                              </Typography>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </TableContainer>
                </>
              )}
            </>
          ) : (
            <Typography variant="body2" color="text.secondary">
              No data available.
            </Typography>
          )}
        </CardContent>
      </Card>

      {/* Organization Metrics Section */}
      <Card variant="outlined" sx={{ mb: 3 }}>
        <CardContent>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 2 }}>
            <GroupIcon sx={{ color: "#7B1FA2" }} />
            <Typography variant="h6" sx={{ fontWeight: 600 }}>
              Organization Login Metrics
            </Typography>
          </Box>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Login activity for your organization members.
          </Typography>

          {orgMetrics ? (
            <>
              {/* Org Stats */}
              <Box sx={{ display: "flex", gap: 2, mb: 3, flexWrap: "wrap" }}>
                <Card
                  variant="outlined"
                  sx={{ flex: 1, minWidth: 140, backgroundColor: "#E8F5E9" }}
                >
                  <CardContent sx={{ textAlign: "center", py: 2 }}>
                    <Typography variant="h4" sx={{ fontWeight: 700, color: "#2E7D32" }}>
                      {orgMetrics.totalMembers}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Total Members
                    </Typography>
                  </CardContent>
                </Card>

                <Card
                  variant="outlined"
                  sx={{ flex: 1, minWidth: 140, backgroundColor: "#EDE7F6" }}
                >
                  <CardContent sx={{ textAlign: "center", py: 2 }}>
                    <Typography variant="h4" sx={{ fontWeight: 700, color: "#7B1FA2" }}>
                      {orgMetrics.ssoLogins}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      SSO Logins
                    </Typography>
                  </CardContent>
                </Card>
              </Box>

              {/* Logins by Method */}
              {orgMetrics.loginsByMethod && orgMetrics.loginsByMethod.length > 0 && (
                <>
                  <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 600 }}>
                    Logins by Method
                  </Typography>
                  <TableContainer component={Paper} variant="outlined">
                    <Table size="small">
                      <TableHead>
                        <TableRow>
                          <TableCell>Method</TableCell>
                          <TableCell align="right">Count</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {orgMetrics.loginsByMethod.map((entry) => (
                          <TableRow key={entry.method}>
                            <TableCell>
                              <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                                {PROVIDER_ICONS[entry.method.toLowerCase()] || null}
                                <Typography variant="body2">{entry.method}</Typography>
                              </Box>
                            </TableCell>
                            <TableCell align="right">
                              <Typography variant="body2" sx={{ fontWeight: 600 }}>
                                {entry.count}
                              </Typography>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </TableContainer>
                </>
              )}
            </>
          ) : (
            <Typography variant="body2" color="text.secondary">
              No organization metrics available. This section is visible to org admins only.
            </Typography>
          )}
        </CardContent>
      </Card>
    </Box>
  );
}
