import React, { useEffect } from 'react';
import { useParams } from 'react-router-dom';

const BusinessRedirect = () => {
  const { businessId } = useParams();
  useEffect(() => {
    // Detect if user has the app installed
    // Try to open the app with deep link
    const deepLinkUrl = `myapp://business/${businessId}`;
    const webUrl = `https://keeptabs.app/business/${businessId}`;
    
    // App store URLs
    const iosAppStoreUrl = 'https://apps.apple.com/app/mytabs/id1234567890'; // Replace with actual app ID
    const androidPlayStoreUrl = 'https://play.google.com/store/apps/details?id=com.mytabs.app'; // Replace with actual package name
    
    // Detect platform
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
    const isAndroid = /Android/.test(navigator.userAgent);
    
    // Try to open the app
    const appStoreUrl = isIOS ? iosAppStoreUrl : isAndroid ? androidPlayStoreUrl : null;
    
    // Attempt to open deep link
    const timeout = setTimeout(() => {
      // If app didn't open in 2 seconds, redirect to app store or web
      if (appStoreUrl) {
        window.location.href = appStoreUrl;
      } else {
        window.location.href = webUrl;
      }
    }, 2000);
    
    // Try to open the deep link
    window.location.href = deepLinkUrl;
    
    return () => clearTimeout(timeout);
  }, [businessId]);

  return (
    <div style={{
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      height: '100vh',
      flexDirection: 'column',
      fontFamily: 'Arial, sans-serif'
    }}>
      <h1>Opening Business Page...</h1>
      <p>If the app doesn't open, you'll be redirected to the app store.</p>
    </div>
  );
};

export default BusinessRedirect;
