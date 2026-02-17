import React, { useState, useEffect } from "react";
import { getEventsByUserId } from "../../services/eventService";
import { getBusiness } from "../../services/businessService";
import { getBusinessAnalytics, getEventPTACount } from "../../services/analyticsService";
import { parseJwt } from "../../utils/common";
import "./AnalyticsView.css";

const AnalyticsView = () => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [analytics, setAnalytics] = useState({
    totalFollowers: 0,
    totalEvents: 0,
    totalPTA: 0,
    activeEvents: 0,
  });
  const [events, setEvents] = useState([]);
  const [businessInfo, setBusinessInfo] = useState(null);

  // Get userId from JWT token
  const idToken = localStorage.getItem("idToken");
  const userId = idToken ? parseJwt(idToken) : null;

  useEffect(() => {
    if (userId) {
      fetchAnalytics();
    }
  }, [userId]);

  const fetchAnalytics = async () => {
    setLoading(true);
    setError(null);

    try {
      console.log("📊 Fetching analytics for userId:", userId);
      
      // Fetch business info
      console.log("1️⃣ Fetching business info...");
      const businessResponse = await getBusiness(userId);
      const business = businessResponse.data;
      setBusinessInfo(business);
      console.log("✅ Business info loaded:", business.name);

      // Fetch all events for the business
      console.log("2️⃣ Fetching events...");
      const eventsResponse = await getEventsByUserId(userId);
      const eventsData = eventsResponse.data || [];
      console.log("✅ Events loaded:", eventsData.length);

      // Fetch PTA count for each event (for the table breakdown)
      console.log("3️⃣ Fetching PTA counts for", eventsData.length, "events...");
      const eventsWithPTA = await Promise.all(
        eventsData.map(async (event) => {
          try {
            const ptaResponse = await getEventPTACount(event._id);
            console.log(`✅ PTA for ${event.name}:`, ptaResponse.data?.count || 0);
            return {
              ...event,
              ptaCount: ptaResponse.data?.count || 0,
            };
          } catch (err) {
            console.warn(`⚠️ Could not fetch PTA for event ${event._id}:`, err.message);
            return {
              ...event,
              ptaCount: 0,
            };
          }
        })
      );

      setEvents(eventsWithPTA);

      // Fetch analytics summary (includes followers count and total PTA)
      console.log("4️⃣ Fetching analytics summary...");
      let followersCount = 0;
      let totalPTA = 0;
      try {
        const analyticsResponse = await getBusinessAnalytics(userId);
        followersCount = analyticsResponse.data?.followersCount || 0;
        totalPTA = analyticsResponse.data?.totalPTA || 0;
        console.log("✅ Analytics summary - Followers:", followersCount, "Total PTA:", totalPTA);
      } catch (err) {
        console.warn("⚠️ Could not fetch analytics summary:", err.message);
        // Fallback: calculate from individual events if backend fails
        totalPTA = eventsWithPTA.reduce((sum, event) => sum + (event.ptaCount || 0), 0);
        console.log("⚠️ Using fallback PTA calculation:", totalPTA);
      }

      // Calculate analytics
      const now = new Date();
      const activeEventsCount = eventsWithPTA.filter(event => {
        const eventDate = new Date(event.date);
        return eventDate >= now;
      }).length;

      const analyticsData = {
        totalFollowers: followersCount,
        totalEvents: eventsWithPTA.length,
        totalPTA: totalPTA,
        activeEvents: activeEventsCount,
      };

      console.log("📊 Final analytics:", analyticsData);
      setAnalytics(analyticsData);

      setLoading(false);
      console.log("✅ Analytics loaded successfully!");
    } catch (err) {
      console.error("❌ Error fetching analytics:", err);
      console.error("Error details:", err.response?.data || err.message);
      setError(`Failed to load analytics data: ${err.message}`);
      setLoading(false);
    }
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  const isEventActive = (dateString) => {
    const eventDate = new Date(dateString);
    const now = new Date();
    return eventDate >= now;
  };

  if (loading) {
    return (
      <div className="analytics-container">
        <div className="loading-container">
          <div className="loading-spinner"></div>
          <p className="loading-text">Loading analytics...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="analytics-container">
      <div className="analytics-content">
        <div className="analytics-header">
          <h1>Business Analytics</h1>
          <p>
            {businessInfo?.name || "Your Business"} - Track your performance and engagement
          </p>
        </div>

        {error && (
          <div className="error-container">
            <p className="error-text">{error}</p>
          </div>
        )}

      <div className="analytics-grid">
        <div className="analytics-card">
          <div className="analytics-card-header">
            <div className="analytics-card-icon icon-followers">
              👥
            </div>
            <div className="analytics-card-title">Total Followers</div>
          </div>
          <div className="analytics-card-value">{analytics.totalFollowers}</div>
          <div className="analytics-card-subtitle">
            Users following your business
          </div>
        </div>

        <div className="analytics-card">
          <div className="analytics-card-header">
            <div className="analytics-card-icon icon-events">
              📅
            </div>
            <div className="analytics-card-title">Total Events</div>
          </div>
          <div className="analytics-card-value">{analytics.totalEvents}</div>
          <div className="analytics-card-subtitle">
            All events created
          </div>
        </div>

        <div className="analytics-card">
          <div className="analytics-card-header">
            <div className="analytics-card-icon icon-pta">
              ✓
            </div>
            <div className="analytics-card-title">Total PTA</div>
          </div>
          <div className="analytics-card-value">{analytics.totalPTA}</div>
          <div className="analytics-card-subtitle">
            Planning to attend across all events
          </div>
        </div>

        <div className="analytics-card">
          <div className="analytics-card-header">
            <div className="analytics-card-icon icon-active">
              🔥
            </div>
            <div className="analytics-card-title">Active Events</div>
          </div>
          <div className="analytics-card-value">{analytics.activeEvents}</div>
          <div className="analytics-card-subtitle">
            Upcoming events
          </div>
        </div>
      </div>

      <div className="analytics-events-section">
        <div className="analytics-events-header">
          <h2>Events Breakdown</h2>
          <button
            className="refresh-button"
            onClick={fetchAnalytics}
            disabled={loading}
          >
            🔄 Refresh
          </button>
        </div>

        {events.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon">📊</div>
            <p className="empty-state-text">
              No events yet. Create your first event to see analytics!
            </p>
          </div>
        ) : (
          <table className="events-table">
            <thead>
              <tr>
                <th>Event Name</th>
                <th>Date</th>
                <th>Status</th>
                <th>PTA Count</th>
              </tr>
            </thead>
            <tbody>
              {events.map((event) => (
                <tr key={event._id}>
                  <td className="event-name">{event.name}</td>
                  <td className="event-date">{formatDate(event.date)}</td>
                  <td>
                    {isEventActive(event.date) ? (
                      <span style={{ color: "#43e97b", fontWeight: 500 }}>
                        Active
                      </span>
                    ) : (
                      <span style={{ color: "#999" }}>Past</span>
                    )}
                  </td>
                  <td>
                    <span className="pta-badge">
                      {event.ptaCount || 0}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      </div>
    </div>
  );
};

export default AnalyticsView;
