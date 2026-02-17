import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { getBusiness } from "../../services/businessService";
import { getEventsByUserId } from "../../services/eventService";
import { getBusinessAnalytics, getEventPTACount } from "../../services/analyticsService";
import { parseJwt } from "../../utils/common";
import "./HomeMainView.css";

const HomeMainView = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [businessName, setBusinessName] = useState("");
  const [metrics, setMetrics] = useState({
    totalEvents: 0,
    activeEvents: 0,
    followers: 0,
    totalPTA: 0,
  });
  const [upcomingEvents, setUpcomingEvents] = useState([]);

  const idToken = localStorage.getItem("idToken");
  const userId = idToken ? parseJwt(idToken) : null;

  useEffect(() => {
    if (userId) {
      fetchDashboardData();
    }
  }, [userId]);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);

      // Fetch business info
      const businessRes = await getBusiness(userId);
      setBusinessName(businessRes.data?.name || "Your Business");

      // Fetch events
      const eventsRes = await getEventsByUserId(userId);
      const events = eventsRes.data || [];
      
      const now = new Date();
      // Filter all upcoming events for the count
      const allUpcoming = events
        .filter(e => new Date(e.date) >= now)
        .sort((a, b) => new Date(a.date) - new Date(b.date));
      
      // Show only first 3 upcoming events in the preview section
      const upcomingForDisplay = allUpcoming.slice(0, 3);
      
      // Fetch PTA count for each upcoming event
      const upcomingWithPTA = await Promise.all(
        upcomingForDisplay.map(async (event) => {
          try {
            const ptaResponse = await getEventPTACount(event._id);
            return {
              ...event,
              ptaCount: ptaResponse.data?.count || 0,
            };
          } catch (err) {
            console.warn(`Could not fetch PTA for event ${event._id}:`, err);
            return {
              ...event,
              ptaCount: 0,
            };
          }
        })
      );
      
      setUpcomingEvents(upcomingWithPTA);

      // Fetch analytics for followers count and total PTA
      let followersCount = 0;
      let totalPTA = 0;
      try {
        const analyticsRes = await getBusinessAnalytics(userId);
        followersCount = analyticsRes.data?.followersCount || 0;
        totalPTA = analyticsRes.data?.totalPTA || 0;
      } catch (err) {
        console.warn("Could not fetch analytics:", err);
      }

      setMetrics({
        totalEvents: events.length,
        activeEvents: allUpcoming.length, // Use full count, not sliced
        followers: followersCount,
        totalPTA: totalPTA,
      });

      setLoading(false);
    } catch (err) {
      console.error("Error fetching dashboard data:", err);
      setLoading(false);
    }
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    });
  };

  if (loading) {
    return (
      <div className="home-container">
        <div className="home-content">
          <div style={{ textAlign: "center", padding: "60px 20px" }}>
            <div style={{ 
              width: "48px", 
              height: "48px", 
              border: "4px solid #f0f0f0", 
              borderTopColor: "#F09925",
              borderRadius: "50%",
              animation: "spin 1s linear infinite",
              margin: "0 auto 16px"
            }}></div>
            <p style={{ color: "#666" }}>Loading dashboard...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="home-container">
      <div className="home-content">
        {/* Welcome Section */}
        <div className="welcome-section">
          <h1 className="welcome-title">Welcome back, {businessName}! 🎉</h1>
          <p className="welcome-subtitle">
            Here's what's happening with your business
          </p>
        </div>

        {/* Metrics Grid */}
        <div className="metrics-grid">
          <div className="metric-card">
            <div className="metric-icon">📅</div>
            <div className="metric-value">{metrics.totalEvents}</div>
            <div className="metric-label">Total Events</div>
          </div>
          <div className="metric-card">
            <div className="metric-icon">🔥</div>
            <div className="metric-value">{metrics.activeEvents}</div>
            <div className="metric-label">Active Events</div>
          </div>
          <div className="metric-card">
            <div className="metric-icon">👥</div>
            <div className="metric-value">{metrics.followers}</div>
            <div className="metric-label">Followers</div>
          </div>
          <div className="metric-card">
            <div className="metric-icon">✓</div>
            <div className="metric-value">{metrics.totalPTA}</div>
            <div className="metric-label">Total PTA</div>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="quick-actions-section">
          <h2 className="section-title">Quick Actions</h2>
          <div className="actions-grid">
            <button 
              className="action-button"
              onClick={() => navigate("/admin/my-events")}
            >
              <span className="action-icon">📅</span>
              Create Event
            </button>
            <button 
              className="action-button"
              onClick={() => navigate("/admin/my-business")}
            >
              <span className="action-icon">🏢</span>
              Edit Business
            </button>
            <button 
              className="action-button"
              onClick={() => navigate("/admin/analytics")}
            >
              <span className="action-icon">📊</span>
              View Analytics
            </button>
            <button 
              className="action-button"
              onClick={() => navigate("/admin/my-business")}
            >
              <span className="action-icon">📸</span>
              Upload Photos
            </button>
            <button 
              className="action-button"
              onClick={() => navigate("/admin/my-business")}
            >
              <span className="action-icon">🍽️</span>
              Edit Menus
            </button>
          </div>
        </div>

        {/* Upcoming Events */}
        <div className="upcoming-events-section">
          <h2 className="section-title">Upcoming Events</h2>
          {upcomingEvents.length > 0 ? (
            <div className="event-list">
              {upcomingEvents.map((event) => (
                <div key={event._id} className="event-item">
                  <div className="event-info">
                    <div className="event-name">{event.name}</div>
                    <div className="event-date">
                      {formatDate(event.date)}
                    </div>
                  </div>
                  <div className="event-pta">
                    {event.ptaCount || 0} PTA
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="empty-state">
              <div className="empty-state-icon">📅</div>
              <p className="empty-state-text">
                No upcoming events. Create one to get started!
              </p>
            </div>
          )}
        </div>

        {/* Recent Activity */}
        <div className="recent-activity-section">
          <h2 className="section-title">Recent Activity</h2>
          <div className="activity-list">
            {metrics.followers > 0 && (
              <div className="activity-item">
                <span className="activity-icon">🎉</span>
                <span className="activity-text">
                  {metrics.followers} people are following your business
                </span>
              </div>
            )}
            {metrics.activeEvents > 0 && (
              <div className="activity-item">
                <span className="activity-icon">📅</span>
                <span className="activity-text">
                  You have {metrics.activeEvents} active event{metrics.activeEvents !== 1 ? 's' : ''}
                </span>
              </div>
            )}
            <div className="activity-item">
              <span className="activity-icon">💡</span>
              <span className="activity-text">
                Tip: Add photos to your business profile to boost engagement
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default HomeMainView;