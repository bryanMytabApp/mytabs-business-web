import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import moment from "moment";
import { getEvent, updateEvent, getPresignedUrlForEvent } from "../../services/eventService";
import { getMyOrganizations, getOrganizationBusinesses } from "../../services/organizationService";
import { getEventPicture } from "../../utils/common";
import { MTBLoading } from "../../components";
import axios from "axios";
import EventCreateNew from "./EventCreateNew";

const parseJwt = (token) => {
  if (!token || typeof token !== 'string' || token.split('.').length !== 3) return null;
  try {
    const base64Url = token.split(".")[1];
    const base64 = base64Url.replace(/-/g, "+").replace(/_/g, "/");
    const jsonPayload = decodeURIComponent(atob(base64).split("").map(c => "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2)).join(""));
    return JSON.parse(jsonPayload)["custom:user_id"];
  } catch { return null; }
};

const EventEditNew = () => {
  const { eventId } = useParams();
  const navigate = useNavigate();
  const [eventData, setEventData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      const token = localStorage.getItem("idToken");
      const userId = parseJwt(token);
      if (!userId || !eventId) { setLoading(false); return; }

      console.log('🔍 EventEditNew load - logged in userId:', userId);
      
      // Determine the correct userId for event API calls
      // If user has a selected business, use that business owner's userId
      const savedBizId = sessionStorage.getItem("selectedBusinessId");
      let apiUserId = userId; // Default to logged-in user
      
      console.log('🔍 EventEditNew - savedBizId from sessionStorage:', savedBizId);
      
      // Always try to resolve the business owner's userId
      try {
        const orgRes = await getMyOrganizations();
        const orgs = orgRes?.data?.organizations || orgRes?.data || [];
        console.log('🔍 EventEditNew - organizations:', orgs.length);
        
        if (orgs.length > 0) {
          const orgId = orgs[0].organizationId || orgs[0].id || orgs[0]._id;
          const bizRes = await getOrganizationBusinesses(orgId);
          const businesses = bizRes?.data?.businesses || bizRes?.data || [];
          console.log('🔍 EventEditNew - businesses from org:', businesses.map(b => ({ 
            linkedBusinessId: b.linkedBusinessId, 
            userId: b.userId, 
            name: b.name 
          })));
          
          // Find the selected business or use the first one
          const targetBizId = savedBizId || (businesses.length > 0 ? businesses[0].linkedBusinessId : null);
          const selectedBiz = businesses.find(b => b.linkedBusinessId === targetBizId);
          
          console.log('🔍 EventEditNew - targetBizId:', targetBizId);
          console.log('🔍 EventEditNew - selectedBiz:', selectedBiz);
          
          if (selectedBiz && selectedBiz.userId) {
            apiUserId = selectedBiz.userId;
            console.log('🔍 EventEditNew - using business owner userId:', apiUserId);
          } else {
            console.warn('⚠️ EventEditNew - selectedBiz.userId is missing, falling back to logged-in user');
          }
        }
      } catch (err) {
        console.error('Error resolving business owner userId:', err);
      }
      
      console.log('🔍 EventEditNew - FINAL apiUserId for event fetch:', apiUserId);

      try {
        const res = await getEvent(apiUserId, eventId);
        const ev = res.data;
        console.log('🔍 Event data from API:', { eventCode: ev.eventCode, _id: ev._id, name: ev.name });

        // Map API event data to the form shape used by EventCreateNew
        const formData = {
          _id: ev._id,
          adType: ev.showDates?.length > 0 ? "shows" : "event",
          name: ev.name || "",
          cat: ev.category || ev.cat || "Athletics",
          date: ev.startDate ? moment(ev.startDate).format("YYYY-MM-DD") : "",
          t1: ev.startDate ? moment(ev.startDate).format("HH:mm") : "",
          t2: ev.endDate ? moment(ev.endDate).format("HH:mm") : "",
          cap: ev.capacity || "",
          desc: ev.description || "",
          venue: ev.venue || "",
          loc: ev.address1 ? "new" : "biz",
          addr: ev.address1 || "",
          city: ev.city || "",
          zip: ev.zipCode || ev.state ? `${ev.state || ""} ${ev.zipCode || ""}`.trim() : "",
          media: getEventPicture(ev._id),
          mediaFile: null,
          tickType: ev.ticketType === "tabs" ? "tabs" : ev.ticketType === "external" ? "ext" : ev.tickets?.some(t => t.option === "Tabs Tickets" || t.option === "Tickets with Tabs") ? "tabs" : ev.tickets?.some(t => t.option === "External link") ? "ext" : "none",
          extUrl: ev.tickets?.find(t => t.option === "External link")?.link1 || "",
          extName: ev.tickets?.find(t => t.option === "External link")?.type || "",
          freeName: ev.tickets?.find(t => t.option === "Free")?.type || "",
          tickets: (ev.tickets || []).filter(t => t.option === "Tabs Tickets" || t.option === "Tickets with Tabs").map(t => ({
            id: t.id || Math.random().toString(36).slice(2, 8),
            type: t.type || "General Admission",
            price: t.price || "",
            qty: t.quantity || "",
            max: String(t.maxPerPurchase || 10),
            desc: t.description || "",
            showDateId: t.showDateId || "all",
            customName: t.customName || "",
          })),
          kpis: (ev.kpis || []).map(k => ({
            id: k.id || Math.random().toString(36).slice(2, 8),
            label: k.label || "",
            type: k.type || "number",
            target: String(k.target || ""),
            cur: String(k.current || k.cur || "0"),
            unit: k.unit || "",
            alert: k.alert || 70,
          })),
          checkpoints: ev.checkpoints || [90, 30, 14, 7],
          channels: ev.channels || null,
          showDates: ev.showDates || [],
          visibility: ev.visibility || "public",
          eventCode: ev.eventCode || "",
        };

        setEventData(formData);
      } catch (err) {
        console.error("Failed to load event:", err);
        toast.error("Failed to load event");
        navigate("/admin/my-events");
      }
      setLoading(false);
    };
    load();
  }, [eventId]);

  // Suspense fallback already covers chunk load. Skip the second spinner.
  // (Was: if (loading) return <MTBLoading />.)

  if (!eventData) return null;

  return <EventCreateNew editMode={true} editData={eventData} eventId={eventId} />;
};

export default EventEditNew;
