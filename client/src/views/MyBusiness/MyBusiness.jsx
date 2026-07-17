import React, { useEffect, useRef, useState } from "react";
import { useNavigate, useParams, useLocation } from "react-router-dom";
import { Box, Typography, Button, IconButton, Tooltip, CircularProgress, Select, MenuItem, Dialog, DialogTitle, DialogContent, DialogActions, Chip, TextField, Autocomplete } from "@mui/material";
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import CloseIcon from '@mui/icons-material/Close';
import { toast } from "react-toastify";
import { getUserById } from "../../services/userService";
import { State, City } from 'country-state-city';
import { getBusinessPicture } from "../../utils/common";
import { getBusiness, getPresignedUrlForBusiness, getPresignedUrlForGalleryPhoto, getPresignedUrlForMenu, updateBusiness } from "../../services/businessService";
import { getOrganizationBusinesses, getMyOrganizations } from "../../services/organizationService";
import { formatPhone, unformatPhone } from "../../utils/phoneMask";
import SettingsCard from "../MyTabsConfiguration/components/SettingsCard";
import SettingsFieldGroup from "../MyTabsConfiguration/components/SettingsFieldGroup";
import QRCode from "react-qr-code";
import { jsPDF } from "jspdf";
import config from "../../config.json";
import axios from "axios";
import categoriesJS from "../../utils/data/categories";
import MemberListsTab from './MemberListsTab';

const countryCode = 'US';
let userId;

const businessTypes = [
  { name: 'Entity/Individual', value: 0 },
  { name: 'Group/Organization', value: 1 },
  { name: 'Business/Corp', value: 2 },
];

const inputStyle = {
  width: '100%', padding: '10px 14px', borderRadius: '8px',
  border: '1px solid #E5E7EB', fontSize: '14px', fontFamily: 'Outfit, sans-serif',
  backgroundColor: '#FFFFFF', outline: 'none', boxSizing: 'border-box',
};

const predefinedTags = ['Featured', 'Event', 'Food', 'Drinks', 'Music', 'Ambiance', 'Team', 'Promo', 'Seasonal', 'Special'];

const UploadDialog = ({ open, onClose, onConfirm, type = 'photo' }) => {
  const [files, setFiles] = useState([]);
  const [previews, setPreviews] = useState([]);
  const [selectedTags, setSelectedTags] = useState([]);
  const [customTag, setCustomTag] = useState('');

  const handleFileSelect = (e) => {
    const selected = Array.from(e.target.files);
    setFiles(selected);
    setPreviews(selected.map(f => URL.createObjectURL(f)));
  };

  const handleAddCustomTag = () => {
    const tag = customTag.trim();
    if (tag && !selectedTags.includes(tag)) {
      setSelectedTags([...selectedTags, tag]);
      setCustomTag('');
    }
  };

  const handleToggleTag = (tag) => {
    setSelectedTags(prev => prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]);
  };

  const handleRemoveTag = (tag) => {
    setSelectedTags(prev => prev.filter(t => t !== tag));
  };

  const handleConfirm = () => {
    onConfirm(files, selectedTags);
    // Reset
    setFiles([]);
    setPreviews([]);
    setSelectedTags([]);
    setCustomTag('');
    onClose();
  };

  const handleClose = () => {
    setFiles([]);
    setPreviews([]);
    setSelectedTags([]);
    setCustomTag('');
    onClose();
  };

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth PaperProps={{ sx: { borderRadius: '16px' } }}>
      <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', pb: 1 }}>
        <Typography sx={{ fontSize: '18px', fontWeight: 700, color: '#111827' }}>
          {type === 'photo' ? 'Add Photos' : 'Upload Menu'}
        </Typography>
        <IconButton size="small" onClick={handleClose}>
          <CloseIcon sx={{ fontSize: '20px' }} />
        </IconButton>
      </DialogTitle>
      <DialogContent sx={{ pt: 1 }}>
        {/* File drop zone */}
        <Box
          component="label"
          sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '140px', border: '2px dashed #E5E7EB', borderRadius: '12px', backgroundColor: '#FAFBFC', cursor: 'pointer', mb: 2, '&:hover': { borderColor: '#4F46E5', backgroundColor: '#F5F3FF' } }}
        >
          {previews.length === 0 ? (
            <Box sx={{ textAlign: 'center', py: 3 }}>
              <Typography sx={{ fontSize: '28px', mb: 1 }}>{type === 'photo' ? '📷' : '📋'}</Typography>
              <Typography sx={{ fontSize: '14px', fontWeight: 500, color: '#374151' }}>Click to select {type === 'photo' ? 'photos' : 'a menu file'}</Typography>
              <Typography sx={{ fontSize: '12px', color: '#9CA3AF' }}>{type === 'photo' ? 'JPG, PNG • Multiple files allowed' : 'PDF or image file'}</Typography>
            </Box>
          ) : (
            <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px', p: 2, width: '100%', boxSizing: 'border-box' }}>
              {previews.map((src, idx) => (
                <Box key={idx} sx={{ paddingTop: '100%', position: 'relative', borderRadius: '8px', overflow: 'hidden' }}>
                  <img src={src} alt="" style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', objectFit: 'cover' }} />
                </Box>
              ))}
            </Box>
          )}
          <input type="file" accept={type === 'photo' ? 'image/*' : '.pdf,image/*'} multiple={type === 'photo'} hidden onChange={handleFileSelect} />
        </Box>

        {/* Tags section */}
        <Typography sx={{ fontSize: '14px', fontWeight: 600, color: '#111827', mb: 1 }}>Tags</Typography>
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mb: 2 }}>
          {predefinedTags.map(tag => (
            <Chip
              key={tag}
              label={tag}
              size="small"
              onClick={() => handleToggleTag(tag)}
              sx={{
                borderRadius: '16px', fontSize: '12px', fontWeight: 500,
                backgroundColor: selectedTags.includes(tag) ? '#4F46E5' : '#F3F4F6',
                color: selectedTags.includes(tag) ? '#fff' : '#374151',
                '&:hover': { backgroundColor: selectedTags.includes(tag) ? '#4338CA' : '#E5E7EB' },
              }}
            />
          ))}
        </Box>

        {/* Custom tag input */}
        <Box sx={{ display: 'flex', gap: 1, mb: 2 }}>
          <TextField
            size="small"
            value={customTag}
            onChange={(e) => setCustomTag(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleAddCustomTag(); } }}
            placeholder="Add custom tag..."
            fullWidth
            sx={{ '& .MuiOutlinedInput-root': { borderRadius: '8px', fontSize: '14px' } }}
          />
          <Button onClick={handleAddCustomTag} disabled={!customTag.trim()} variant="outlined" size="small" sx={{ textTransform: 'none', borderRadius: '8px', borderColor: '#E5E7EB', color: '#4F46E5', whiteSpace: 'nowrap' }}>
            Add
          </Button>
        </Box>

        {/* Selected tags */}
        {selectedTags.length > 0 && (
          <Box sx={{ mb: 1 }}>
            <Typography sx={{ fontSize: '12px', color: '#6B7280', mb: 0.5 }}>Selected tags:</Typography>
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
              {selectedTags.map(tag => (
                <Chip key={tag} label={tag} size="small" onDelete={() => handleRemoveTag(tag)}
                  sx={{ borderRadius: '16px', fontSize: '11px', backgroundColor: '#EEF2FF', color: '#4F46E5' }} />
              ))}
            </Box>
          </Box>
        )}
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={handleClose} sx={{ textTransform: 'none', color: '#6B7280', borderRadius: '8px' }}>Cancel</Button>
        <Button onClick={handleConfirm} disabled={files.length === 0} variant="contained" disableElevation
          sx={{ textTransform: 'none', backgroundColor: '#4F46E5', borderRadius: '8px', fontWeight: 600, '&:hover': { backgroundColor: '#4338CA' }, '&:disabled': { backgroundColor: '#A5B4FC' } }}>
          {type === 'photo' ? `Upload ${files.length || ''} Photo${files.length !== 1 ? 's' : ''}` : 'Upload Menu'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

const GalleryTab = ({ item, photoGallery, onLabelChange, onPhotoUpload, onRemovePhoto, readOnly }) => {
  const [search, setSearch] = useState('');
  const [activeCategory, setActiveCategory] = useState('all');
  const [uploadOpen, setUploadOpen] = useState(false);
  const [gridCols, setGridCols] = useState(3);
  const galleries = ['gallery1', 'gallery2', 'gallery3', 'gallery4'];

  // Flatten all photos with category info
  const allPhotos = galleries.flatMap((galleryId, idx) => {
    const label = item[`photoGalleryLabel${idx + 1}`] || `Gallery ${idx + 1}`;
    return (photoGallery[galleryId] || []).map((photo, photoIdx) => ({
      ...photo, galleryId, galleryIdx: idx, label, photoIdx
    }));
  });

  // Filter photos
  const filteredPhotos = allPhotos.filter(photo => {
    if (activeCategory !== 'all' && photo.galleryId !== activeCategory) return false;
    if (search && !photo.label.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  return (
    <Box sx={{ backgroundColor: '#fff', borderRadius: '16px', padding: '28px', boxShadow: '0 2px 12px rgba(0,0,0,0.06)' }}>
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2, flexWrap: 'wrap', gap: 1 }}>
        <Box>
          <Typography sx={{ fontSize: '18px', fontWeight: 700, color: '#111827' }}>Photo Gallery</Typography>
          <Typography sx={{ fontSize: '13px', color: '#6B7280' }}>{allPhotos.length} photo{allPhotos.length !== 1 ? 's' : ''}</Typography>
        </Box>
        <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', flexWrap: 'wrap' }}>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search..."
            style={{ padding: '8px 14px', borderRadius: '8px', border: '1px solid #E5E7EB', fontSize: '14px', fontFamily: 'Outfit, sans-serif', width: '180px', outline: 'none' }}
          />
          <Box sx={{ display: 'flex', border: '1px solid #E5E7EB', borderRadius: '8px', overflow: 'hidden' }}>
            {[3, 4, 5].map(n => (
              <Box key={n} onClick={() => setGridCols(n)} sx={{ px: 1.2, py: 0.6, cursor: 'pointer', fontSize: '12px', fontWeight: 600, backgroundColor: gridCols === n ? '#4F46E5' : '#fff', color: gridCols === n ? '#fff' : '#6B7280', borderRight: n < 5 ? '1px solid #E5E7EB' : 'none', display: 'flex', alignItems: 'center' }}>
                {n}
              </Box>
            ))}
          </Box>
          {!readOnly && <Button onClick={() => setUploadOpen(true)} size="small" sx={{ textTransform: 'none', backgroundColor: '#F09925', color: '#fff', borderRadius: '8px', px: 2, fontWeight: 600, whiteSpace: 'nowrap', '&:hover': { backgroundColor: '#e08820' } }}>
            + Add Photos
          </Button>}
        </Box>
      </Box>

      {/* Category filter chips */}
      <Box sx={{ display: 'flex', gap: 1, mb: 3, flexWrap: 'wrap' }}>
        <Box
          onClick={() => setActiveCategory('all')}
          sx={{ px: 2, py: 0.8, borderRadius: '20px', fontSize: '13px', fontWeight: 500, cursor: 'pointer', border: '1px solid', borderColor: activeCategory === 'all' ? '#4F46E5' : '#E5E7EB', backgroundColor: activeCategory === 'all' ? '#EEF2FF' : '#fff', color: activeCategory === 'all' ? '#4F46E5' : '#6B7280' }}
        >
          All ({allPhotos.length})
        </Box>
        {galleries.map((galleryId, idx) => {
          const label = item[`photoGalleryLabel${idx + 1}`] || `Gallery ${idx + 1}`;
          const count = (photoGallery[galleryId] || []).length;
          return (
            <Box
              key={galleryId}
              onClick={() => setActiveCategory(galleryId)}
              sx={{ px: 2, py: 0.8, borderRadius: '20px', fontSize: '13px', fontWeight: 500, cursor: 'pointer', border: '1px solid', borderColor: activeCategory === galleryId ? '#4F46E5' : '#E5E7EB', backgroundColor: activeCategory === galleryId ? '#EEF2FF' : '#fff', color: activeCategory === galleryId ? '#4F46E5' : '#6B7280' }}
            >
              {label} ({count})
            </Box>
          );
        })}
      </Box>

      {/* Category label editor (when a specific category is selected) */}
      {activeCategory !== 'all' && (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
          <Typography sx={{ fontSize: '13px', fontWeight: 500, color: '#374151' }}>Category name:</Typography>
          {readOnly ? (
            <Typography sx={{ fontSize: '14px', fontWeight: 500, color: '#111827' }}>{item[`photoGalleryLabel${galleries.indexOf(activeCategory) + 1}`] || activeCategory}</Typography>
          ) : (
          <input
            type="text"
            value={item[`photoGalleryLabel${galleries.indexOf(activeCategory) + 1}`] || ''}
            onChange={(e) => onLabelChange(galleries.indexOf(activeCategory), e.target.value)}
            placeholder="Enter category name..."
            style={{ padding: '6px 12px', borderRadius: '8px', border: '1px solid #E5E7EB', fontSize: '14px', fontFamily: 'Outfit, sans-serif', backgroundColor: '#fff', outline: 'none', width: '250px' }}
          />
          )}
        </Box>
      )}

      {/* Photo grid - 3x3 */}
      {filteredPhotos.length === 0 ? (
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '200px', border: '2px dashed #E5E7EB', borderRadius: '12px', backgroundColor: '#FAFBFC' }}>
          <Box sx={{ textAlign: 'center' }}>
            <Typography sx={{ fontSize: '32px', mb: 1 }}>📷</Typography>
            <Typography sx={{ color: '#6B7280', fontSize: '14px', fontWeight: 500 }}>No photos yet</Typography>
            <Typography sx={{ color: '#9CA3AF', fontSize: '13px' }}>Click "+ Add Photos" to upload</Typography>
          </Box>
        </Box>
      ) : (
        <Box sx={{ display: 'grid', gridTemplateColumns: `repeat(${gridCols}, 1fr)`, gap: '12px' }}>
          {filteredPhotos.map((photo, idx) => (
            <Box key={idx} sx={{ position: 'relative', paddingTop: '100%', borderRadius: '12px', overflow: 'hidden', border: '1px solid #eee', '&:hover .photo-overlay': { opacity: 1 } }}>
              <img src={photo.preview} alt="" style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', objectFit: 'cover' }} />
              <Box className="photo-overlay" sx={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', background: 'linear-gradient(transparent 50%, rgba(0,0,0,0.6))', opacity: 0, transition: 'opacity 0.2s', display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', p: 1.5 }}>
                <Typography sx={{ color: '#fff', fontSize: '12px', fontWeight: 500 }}>{photo.label}</Typography>
              </Box>
              {!readOnly && <IconButton
                className="photo-overlay"
                size="small"
                onClick={() => onRemovePhoto(photo.galleryId, photo.photoIdx)}
                sx={{ position: 'absolute', top: 8, right: 8, backgroundColor: 'rgba(239,68,68,0.9)', color: '#fff', width: 26, height: 26, opacity: 0, transition: 'opacity 0.2s', '&:hover': { backgroundColor: '#dc2626', opacity: 1 } }}
              >
                <span style={{ fontSize: '14px', fontWeight: 'bold' }}>×</span>
              </IconButton>}
            </Box>
          ))}
        </Box>
      )}

      {/* Upload Dialog */}
      <UploadDialog
        open={uploadOpen}
        onClose={() => setUploadOpen(false)}
        type="photo"
        onConfirm={(files, tags) => {
          const targetGallery = activeCategory !== 'all' ? activeCategory : 'gallery1';
          const dataTransfer = new DataTransfer();
          files.forEach(f => dataTransfer.items.add(f));
          onPhotoUpload({ target: { files: dataTransfer.files } }, targetGallery, tags);
        }}
      />
    </Box>
  );
};

const MenusTab = ({ item, onLabelChange, onMenuUpload, onRemoveMenu, readOnly }) => {
  const [search, setSearch] = useState('');
  const [activeSlot, setActiveSlot] = useState('all');
  const [uploadOpen, setUploadOpen] = useState(false);
  const [gridCols, setGridCols] = useState(3);
  const menuSlots = [1, 2, 3, 4];

  // Build menu items with labels
  const allMenus = menuSlots
    .filter(num => item[`menuUrl${num}`])
    .map(num => ({
      num,
      label: item[`menuLabel${num}`] || `Menu ${num}`,
      url: item[`menuUrl${num}`],
    }));

  // Filter
  const filteredMenus = allMenus.filter(menu => {
    if (activeSlot !== 'all' && menu.num !== activeSlot) return false;
    if (search && !menu.label.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  return (
    <Box sx={{ backgroundColor: '#fff', borderRadius: '16px', padding: '28px', boxShadow: '0 2px 12px rgba(0,0,0,0.06)' }}>
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2, flexWrap: 'wrap', gap: 1 }}>
        <Box>
          <Typography sx={{ fontSize: '18px', fontWeight: 700, color: '#111827' }}>Menus</Typography>
          <Typography sx={{ fontSize: '13px', color: '#6B7280' }}>{allMenus.length} menu{allMenus.length !== 1 ? 's' : ''} uploaded</Typography>
        </Box>
        <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', flexWrap: 'wrap' }}>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search..."
            style={{ padding: '8px 14px', borderRadius: '8px', border: '1px solid #E5E7EB', fontSize: '14px', fontFamily: 'Outfit, sans-serif', width: '180px', outline: 'none' }}
          />
          <Box sx={{ display: 'flex', border: '1px solid #E5E7EB', borderRadius: '8px', overflow: 'hidden' }}>
            {[3, 4, 5].map(n => (
              <Box key={n} onClick={() => setGridCols(n)} sx={{ px: 1.2, py: 0.6, cursor: 'pointer', fontSize: '12px', fontWeight: 600, backgroundColor: gridCols === n ? '#4F46E5' : '#fff', color: gridCols === n ? '#fff' : '#6B7280', borderRight: n < 5 ? '1px solid #E5E7EB' : 'none', display: 'flex', alignItems: 'center' }}>
                {n}
              </Box>
            ))}
          </Box>
          {!readOnly && <Button onClick={() => setUploadOpen(true)} size="small" sx={{ textTransform: 'none', backgroundColor: '#F09925', color: '#fff', borderRadius: '8px', px: 2, fontWeight: 600, whiteSpace: 'nowrap', '&:hover': { backgroundColor: '#e08820' } }}>
            + Upload Menu
          </Button>}
        </Box>
      </Box>

      {/* Slot filter chips */}
      <Box sx={{ display: 'flex', gap: 1, mb: 3, flexWrap: 'wrap' }}>
        <Box
          onClick={() => setActiveSlot('all')}
          sx={{ px: 2, py: 0.8, borderRadius: '20px', fontSize: '13px', fontWeight: 500, cursor: 'pointer', border: '1px solid', borderColor: activeSlot === 'all' ? '#4F46E5' : '#E5E7EB', backgroundColor: activeSlot === 'all' ? '#EEF2FF' : '#fff', color: activeSlot === 'all' ? '#4F46E5' : '#6B7280' }}
        >
          All ({allMenus.length})
        </Box>
        {menuSlots.map(num => {
          const label = item[`menuLabel${num}`] || `Menu ${num}`;
          const hasMenu = !!item[`menuUrl${num}`];
          return (
            <Box
              key={num}
              onClick={() => setActiveSlot(num)}
              sx={{ px: 2, py: 0.8, borderRadius: '20px', fontSize: '13px', fontWeight: 500, cursor: 'pointer', border: '1px solid', borderColor: activeSlot === num ? '#4F46E5' : '#E5E7EB', backgroundColor: activeSlot === num ? '#EEF2FF' : '#fff', color: activeSlot === num ? '#4F46E5' : '#6B7280' }}
            >
              {label} {hasMenu ? '✓' : ''}
            </Box>
          );
        })}
      </Box>

      {/* Slot label editor */}
      {activeSlot !== 'all' && (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
          <Typography sx={{ fontSize: '13px', fontWeight: 500, color: '#374151' }}>Menu name:</Typography>
          {readOnly ? (
            <Typography sx={{ fontSize: '14px', fontWeight: 500, color: '#111827' }}>{item[`menuLabel${activeSlot}`] || `Menu ${activeSlot}`}</Typography>
          ) : (
          <input
            type="text"
            value={item[`menuLabel${activeSlot}`] || ''}
            onChange={(e) => onLabelChange(activeSlot, e.target.value)}
            placeholder="Enter menu name..."
            style={{ padding: '6px 12px', borderRadius: '8px', border: '1px solid #E5E7EB', fontSize: '14px', fontFamily: 'Outfit, sans-serif', backgroundColor: '#fff', outline: 'none', width: '250px' }}
          />
          )}
        </Box>
      )}

      {/* Menu grid */}
      {filteredMenus.length === 0 ? (
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '200px', border: '2px dashed #E5E7EB', borderRadius: '12px', backgroundColor: '#FAFBFC' }}>
          <Box sx={{ textAlign: 'center' }}>
            <Typography sx={{ fontSize: '32px', mb: 1 }}>📋</Typography>
            <Typography sx={{ color: '#6B7280', fontSize: '14px', fontWeight: 500 }}>No menus yet</Typography>
            <Typography sx={{ color: '#9CA3AF', fontSize: '13px' }}>Click "+ Upload Menu" to add one</Typography>
          </Box>
        </Box>
      ) : (
        <Box sx={{ display: 'grid', gridTemplateColumns: `repeat(${gridCols}, 1fr)`, gap: '12px' }}>
          {filteredMenus.map((menu) => (
            <Box key={menu.num} sx={{ position: 'relative', paddingTop: '100%', borderRadius: '12px', overflow: 'hidden', border: '1px solid #eee', '&:hover .menu-overlay': { opacity: 1 } }}>
              <img src={menu.url} alt={menu.label} style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', objectFit: 'cover' }} />
              <Box className="menu-overlay" sx={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', background: 'linear-gradient(transparent 50%, rgba(0,0,0,0.6))', opacity: 0, transition: 'opacity 0.2s', display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', p: 1.5 }}>
                <Typography sx={{ color: '#fff', fontSize: '12px', fontWeight: 500 }}>{menu.label}</Typography>
              </Box>
              {!readOnly && <IconButton
                className="menu-overlay"
                size="small"
                onClick={() => onRemoveMenu(menu.num)}
                sx={{ position: 'absolute', top: 8, right: 8, backgroundColor: 'rgba(239,68,68,0.9)', color: '#fff', width: 26, height: 26, opacity: 0, transition: 'opacity 0.2s', '&:hover': { backgroundColor: '#dc2626', opacity: 1 } }}
              >
                <span style={{ fontSize: '14px', fontWeight: 'bold' }}>×</span>
              </IconButton>}
            </Box>
          ))}
        </Box>
      )}

      {/* Upload Dialog */}
      <UploadDialog
        open={uploadOpen}
        onClose={() => setUploadOpen(false)}
        type="menu"
        onConfirm={(files, tags) => {
          const targetSlot = activeSlot !== 'all' ? activeSlot : (menuSlots.find(n => !item[`menuUrl${n}`]) || 1);
          const dataTransfer = new DataTransfer();
          files.forEach(f => dataTransfer.items.add(f));
          onMenuUpload({ target: { files: dataTransfer.files } }, targetSlot, tags);
        }}
      />
    </Box>
  );
};

const MyBusiness = () => {
  const { businessId: routeBusinessId } = useParams();
  const navigation = useNavigate();
  const location = useLocation();
  const [states, setStates] = useState([]);
  const [cities, setCities] = useState([]);
  const [item, setItem] = useState({ type: 'Entity/Individual' });
  const [originalItem, setOriginalItem] = useState(null);
  const [subcategories, setSubcategories] = useState([]);
  const [originalSubcategories, setOriginalSubcategories] = useState([]);
  const [selectedCategoryType, setSelectedCategoryType] = useState('');
  const [originalPhotoGallery, setOriginalPhotoGallery] = useState({});
  const [uploadedImage, setUploadedImage] = useState(null);
  const [, setAllBusinesses] = useState([]);
  const [hasOrganization, setHasOrganization] = useState(false);
  const [logoPreviewOpen, setLogoPreviewOpen] = useState(false);
  const [selectedBusinessId, setSelectedBusinessId] = useState(routeBusinessId || sessionStorage.getItem("selectedBusinessId") || null);
  const [codeCopied, setCodeCopied] = useState(false);
  const [loading, setLoading] = useState(true);
  const [userRole, setUserRole] = useState('owner'); // 'owner' | 'admin' | 'member'
  const [photoGallery, setPhotoGallery] = useState({ gallery1: [], gallery2: [], gallery3: [], gallery4: [] });
  const [menuFiles, setMenuFiles] = useState({ menu1: null, menu2: null, menu3: null, menu4: null });

  // Tab mapping for URL hash
  const tabMap = { profile: 0, gallery: 1, menus: 2, 'member-lists': 3 };
  const tabNames = ['profile', 'gallery', 'menus', 'member-lists'];
  
  // Get initial tab from URL hash
  const getTabFromHash = () => {
    const hash = location.hash.replace('#', '').toLowerCase();
    return tabMap[hash] !== undefined ? tabMap[hash] : 0;
  };
  
  const [activeTab, setActiveTab] = useState(getTabFromHash());

  // Update URL hash when tab changes
  const handleTabChange = (tabIndex) => {
    setActiveTab(tabIndex);
    navigation(`#${tabNames[tabIndex]}`, { replace: true });
  };

  // Listen for hash changes (browser back/forward)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    const handleHashChange = () => {
      setActiveTab(getTabFromHash());
    };
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Set initial hash if not present
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!location.hash) {
      navigation(`#${tabNames[0]}`, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const inputref = useRef(null);
  const addressInputRef = useRef(null);
  const autocompleteRef = useRef(null);

  const parseJwt = (token) => {
    try {
      if (!token) return null;
      const base64Url = token.split(".")[1];
      if (!base64Url) return null;
      const base64 = base64Url.replace(/-/g, "+").replace(/_/g, "/");
      const jsonPayload = decodeURIComponent(atob(base64).split("").map(c => "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2)).join(""));
      return JSON.parse(jsonPayload)["custom:user_id"];
    } catch (error) { return null; }
  };

  const init = (targetBusinessId) => {
    setLoading(true);
    setItem({ type: 'Entity/Individual' }); // Reset to prevent flash of previous business
    
    // Run all API calls in parallel instead of sequentially
    // Try with businessId first; if it returns empty (team member accessing
    // a business they don't own), fall back to letting the Lambda resolve via access table.
    const businessPromise = getBusiness(userId, targetBusinessId || undefined)
      .then(res => {
        if (res?.data && res.data._id) return res;
        // Fallback: let Lambda resolve through User_Business_Access
        return getBusiness(userId);
      });
    const orgPromise = getMyOrganizations().catch(() => ({ data: { organizations: [] } }));
    const userPromise = getUserById(userId).catch(() => ({ data: {} }));

    // Process business data as soon as it arrives (don't wait for org/user)
    businessPromise.then(res => {
      const biz = res.data;
      setItem(biz);
      setOriginalItem(JSON.parse(JSON.stringify(biz)));
      setSelectedBusinessId(biz._id);
      // Set user role — if accessRole is returned by Lambda, use it; otherwise owner
      if (biz.accessRole) {
        setUserRole(biz.accessRole);
      } else if (biz.userId === userId) {
        setUserRole('owner');
      }
      if (biz.categories && Array.isArray(biz.categories) && biz.categories.length > 0) {
        // Normalize categories to strings — API may return objects with {name, subcategories, text}
        const normalizedCategories = biz.categories.map(cat => {
          if (typeof cat === 'string') return cat;
          return cat.text || (cat.subcategories?.length ? cat.subcategories[0] : cat.name) || '';
        }).filter(Boolean);
        setSubcategories(normalizedCategories);
        setOriginalSubcategories([...normalizedCategories]);
        const parentCat = categoriesJS.find(c => c.subcategories && c.subcategories.some(sub => normalizedCategories.includes(sub)));
        if (parentCat) {
          setSelectedCategoryType(parentCat.name);
        } else {
          const directMatch = categoriesJS.find(c => normalizedCategories.includes(c.name));
          if (directMatch) setSelectedCategoryType(directMatch.name);
        }
      }
      // Load gallery (sync, no API call)
      if (biz.photoGallery) {
        const loadedGallery = {};
        Object.keys(biz.photoGallery).forEach(galleryId => {
          const photoCount = biz.photoGallery[galleryId];
          if (photoCount > 0) {
            loadedGallery[galleryId] = [];
            for (let i = 0; i < photoCount; i++) {
              loadedGallery[galleryId].push({ preview: `${config.bucketUrl}business/${userId}/gallery/${galleryId}/${i}`, category: galleryId });
            }
          }
        });
        setPhotoGallery(prev => ({ ...prev, ...loadedGallery }));
        setOriginalPhotoGallery(prev => ({ ...prev, ...loadedGallery }));
      }
      setLoading(false);
    }).catch(err => { console.error(err); setLoading(false); });

    // Process org data in parallel (don't block page render)
    orgPromise.then(orgRes => {
      const orgs = orgRes?.data?.organizations || orgRes?.data || [];
      if (orgs.length > 0) {
        setHasOrganization(true);
        const orgId = orgs[0].organizationId || orgs[0].id || orgs[0]._id;
        const orgName = orgs[0].name || 'Organization';
        const orgRole = orgs[0].role || 'member';
        getOrganizationBusinesses(orgId).then(async (bizRes) => {
          const businesses = bizRes?.data?.businesses || bizRes?.data || [];
          const allBiz = [];
          if (orgRole === 'owner') {
            // Use the actual business _id from the already-resolved business
            // instead of making another getBusiness call that could flash Urban HTX
            const ownerBizId = targetBusinessId && targetBusinessId !== userId
              ? (await getBusiness(userId).then(r => r?.data?._id).catch(() => userId))
              : (targetBusinessId || userId);
            allBiz.push({ linkedBusinessId: ownerBizId, name: orgName, isPayer: true });
          }
          allBiz.push(...businesses.filter(b => b.linkedBusinessId !== orgId));
          setAllBusinesses(allBiz);
        }).catch(() => {});
      }
    });

    // Process user data as fallback for categories only
    userPromise.then(res => {
      const userData = res.data;
      if (!targetBusinessId && userData?.subcategory) {
        setSubcategories(prev => {
          if (prev.length > 0) return prev;
          const subcats = userData.subcategory.map(sub => sub.text || (sub.subcategories?.length ? sub.subcategories[0] : sub.name));
          return subcats;
        });
      }
    });
  };

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    const token = localStorage.getItem("idToken");
    if (!token) { navigation("/login"); return; }
    userId = parseJwt(token);
    if (!userId) { navigation("/login"); return; }
    setStates(State.getStatesOfCountry(countryCode));

    // If no route param, use the global business context from sessionStorage
    if (!routeBusinessId) {
      const savedBiz = sessionStorage.getItem("selectedBusinessId");
      // Always pass the savedBiz — if null, getBusiness returns the primary (owner's) business
      init(savedBiz);
    } else {
      init(routeBusinessId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!item.state) return;
    const selectedState = states.find(s => s.name === item.state);
    if (selectedState) setCities(City.getCitiesOfState(countryCode, selectedState.isoCode));
  }, [item.state, states]);

  // Google Places Autocomplete — lazy-loaded to avoid blocking every page
  useEffect(() => {
    if (loading || !addressInputRef.current) return;
    let cancelled = false;

    import('../../utils/googleMaps').then(({ loadGoogleMaps }) => loadGoogleMaps()).then(() => {
      if (cancelled || !addressInputRef.current) return;

      autocompleteRef.current = new window.google.maps.places.Autocomplete(
        addressInputRef.current,
        { types: ['address'], componentRestrictions: { country: 'us' } }
      );

      autocompleteRef.current.addListener('place_changed', () => {
        const place = autocompleteRef.current.getPlace();
        if (!place.address_components) return;

        let streetNumber = '', route = '', city = '', state = '', zipCode = '';

        place.address_components.forEach(c => {
          if (c.types.includes('street_number')) streetNumber = c.long_name;
          if (c.types.includes('route')) route = c.long_name;
          if (c.types.includes('locality')) city = c.long_name;
          else if (!city && c.types.includes('sublocality_level_1')) city = c.long_name;
          else if (!city && c.types.includes('sublocality')) city = c.long_name;
          else if (!city && c.types.includes('postal_town')) city = c.long_name;
          else if (!city && c.types.includes('administrative_area_level_3')) city = c.long_name;
          if (c.types.includes('administrative_area_level_1')) state = c.long_name;
          if (c.types.includes('postal_code')) zipCode = c.long_name;
        });

        setItem(prev => ({ ...prev, address1: `${streetNumber} ${route}`.trim(), city, state, zipCode }));
      });
    });

    return () => {
      cancelled = true;
      if (autocompleteRef.current) {
        window.google.maps.event.clearInstanceListeners(autocompleteRef.current);
      }
    };
  }, [loading]);

  const handleItemChange = (key, value) => setItem(prev => ({ ...prev, [key]: value }));

  // Compute dirty flag by comparing current state to original
  const isDirty = (() => {
    if (!originalItem) return false;
    if (uploadedImage) return true;
    if (JSON.stringify(subcategories) !== JSON.stringify(originalSubcategories)) return true;
    if (Object.values(menuFiles).some(f => f !== null)) return true;
    // Check gallery changes (new photos added)
    const galleries = ['gallery1', 'gallery2', 'gallery3', 'gallery4'];
    for (const g of galleries) {
      const current = (photoGallery[g] || []).length;
      const original = (originalPhotoGallery[g] || []).length;
      if (current !== original) return true;
    }
    const fieldsToCheck = ['name', 'designation', 'type', 'phoneNumber', 'website', 'showLocation', 'description', 'state', 'city', 'zipCode', 'address1'];
    return fieldsToCheck.some(f => (item[f] || '') !== (originalItem[f] || ''));
  })();

  const handleCopyCode = (code) => {
    navigator.clipboard.writeText(code);
    setCodeCopied(true);
    setTimeout(() => setCodeCopied(false), 2000);
  };

  const handleSave = async () => {
    try {
      const updatedItem = { ...item, categories: subcategories };
      // If business is not in an organization, always save as public
      if (!hasOrganization) {
        updatedItem.visibility = 'public';
      }
      // Upload logo if changed - bump iconUpdatedAt so caches (CloudFront / mobile) refresh
      if (uploadedImage) {
        const presignedRes = await getPresignedUrlForBusiness(userId);
        const presignedUrl = presignedRes.data;
        const blob = await (await fetch(uploadedImage)).blob();
        await axios.put(presignedUrl, blob, { headers: { 'Content-Type': blob.type } });
        updatedItem.iconUpdatedAt = Date.now();
      }
      // Upload gallery photos
      for (const galleryId of Object.keys(photoGallery)) {
        const photos = photoGallery[galleryId] || [];
        const newPhotos = photos.filter(p => p.file);
        for (let i = 0; i < newPhotos.length; i++) {
          const photo = newPhotos[i];
          const presignedRes = await getPresignedUrlForGalleryPhoto(userId, galleryId, photos.indexOf(photo));
          await axios.put(presignedRes.data, photo.file, { headers: { 'Content-Type': photo.file.type } });
        }
        updatedItem.photoGallery = updatedItem.photoGallery || {};
        updatedItem.photoGallery[galleryId] = photos.length;
      }
      // Upload menus
      for (let i = 1; i <= 4; i++) {
        if (menuFiles[`menu${i}`]) {
          const presignedRes = await getPresignedUrlForMenu(userId, i);
          await axios.put(presignedRes.data, menuFiles[`menu${i}`], { headers: { 'Content-Type': menuFiles[`menu${i}`].type } });
          // Add cache-busting timestamp so updated menus refresh on mobile
          updatedItem[`menuUrl${i}`] = `${config.bucketUrl}business/${userId}/menu${i}?v=${Date.now()}`;
        }
      }
      await updateBusiness(updatedItem);
      // Reset original state after successful save
      setOriginalItem(JSON.parse(JSON.stringify(updatedItem)));
      setOriginalSubcategories([...subcategories]);
      setOriginalPhotoGallery(JSON.parse(JSON.stringify(photoGallery)));
      setUploadedImage(null);
      setMenuFiles({ menu1: null, menu2: null, menu3: null, menu4: null });
      toast.success("Business updated successfully!");
    } catch (err) {
      console.error("Save failed:", err);
      toast.error("Failed to save changes");
      throw err;
    }
  };

  const processFile = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (ev) => setUploadedImage(ev.target.result);
      reader.readAsDataURL(file);
    }
  };

  const handlePhotoUpload = (e, galleryId) => {
    const files = Array.from(e.target.files);
    const newPhotos = files.map(file => ({ preview: URL.createObjectURL(file), file, category: galleryId }));
    setPhotoGallery(prev => ({ ...prev, [galleryId]: [...(prev[galleryId] || []), ...newPhotos] }));
  };

  const removePhoto = (galleryId, index) => {
    setPhotoGallery(prev => ({ ...prev, [galleryId]: prev[galleryId].filter((_, i) => i !== index) }));
  };

  const handleMenuUpload = (e, menuNum) => {
    const file = e.target.files[0];
    if (file) {
      setMenuFiles(prev => ({ ...prev, [`menu${menuNum}`]: file }));
      handleItemChange(`menuUrl${menuNum}`, URL.createObjectURL(file));
    }
  };

  const downloadQRPdf = async () => {
    const qrUrl = item.businessCode 
      ? `https://keeptabs.app/b/${item.businessCode}` 
      : `https://keeptabs.app/business/${item._id}`;
    const businessName = item.name || 'Business';
    const businessCode = item.businessCode || item._id;

    try {
      // Capture the on-screen QR code SVG and convert to PNG for the PDF
      const svg = document.getElementById("QRCode");
      const svgData = new XMLSerializer().serializeToString(svg);
      
      // Render SVG to canvas at high resolution
      const canvas = document.createElement("canvas");
      canvas.width = 1024;
      canvas.height = 1024;
      const ctx = canvas.getContext("2d");
      
      const img = new Image();
      const qrDataUrl = await new Promise((resolve, reject) => {
        img.onload = () => {
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(0, 0, 1024, 1024);
          ctx.drawImage(img, 0, 0, 1024, 1024);
          resolve(canvas.toDataURL("image/png"));
        };
        img.onerror = reject;
        img.src = `data:image/svg+xml;base64,${btoa(unescape(encodeURIComponent(svgData)))}`;
      });

      // Create PDF (4x6 inches - standard print size)
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'in',
        format: [4, 6],
      });

      // Business Name at top
      pdf.setFontSize(18);
      pdf.setFont('helvetica', 'bold');
      const nameWidth = pdf.getTextWidth(businessName);
      pdf.text(businessName, (4 - nameWidth) / 2, 0.7);

      // QR Code centered (2.5 x 2.5 inches)
      const qrSize = 2.5;
      const qrX = (4 - qrSize) / 2;
      const qrY = 1.2;
      pdf.addImage(qrDataUrl, 'PNG', qrX, qrY, qrSize, qrSize);

      // Tabs logo overlay in center of QR
      const logoCenterX = qrX + qrSize / 2;
      const logoCenterY = qrY + qrSize / 2;
      pdf.setFillColor(255, 255, 255);
      pdf.circle(logoCenterX, logoCenterY, 0.22, 'F');
      pdf.setFontSize(7);
      pdf.setFont('helvetica', 'bold');
      pdf.setTextColor(255, 93, 0);
      const tabsW = pdf.getTextWidth('TABS');
      pdf.text('TABS', logoCenterX - tabsW / 2, logoCenterY + 0.03);
      pdf.setTextColor(0, 0, 0);

      // Business Code at bottom
      pdf.setFontSize(12);
      pdf.setFont('helvetica', 'normal');
      const codeWidth = pdf.getTextWidth(businessCode);
      pdf.text(businessCode, (4 - codeWidth) / 2, qrY + qrSize + 0.4);

      // QR URL small text at very bottom
      pdf.setFontSize(8);
      pdf.setTextColor(100, 100, 100);
      const urlWidth = pdf.getTextWidth(qrUrl);
      pdf.text(qrUrl, (4 - urlWidth) / 2, 5.5);

      // Save
      const filename = `${businessName.replace(/[^a-zA-Z0-9]/g, '_')}-QR.pdf`;
      pdf.save(filename);
    } catch (err) {
      console.error('Failed to generate QR PDF:', err);
      toast.error('Failed to generate QR PDF');
    }
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', background: 'linear-gradient(135deg, #e8f4fd 0%, #dbeeff 35%, #f0f8ff 65%, #e2eeff 100%)' }}>
        <CircularProgress sx={{ color: '#0077cc' }} />
      </Box>
    );
  }


  return (
    <Box sx={{ minHeight: '100vh', background: 'linear-gradient(135deg, #e8f4fd 0%, #dbeeff 35%, #f0f8ff 65%, #e2eeff 100%)', padding: '24px' }}>
      <Box sx={{ maxWidth: '1200px', margin: '0 auto' }}>
        {/* Header */}
        <Box sx={{ mb: 2 }}>
          <h1 style={{ fontSize: 26, fontWeight: 1000, color: '#0d1b35', fontFamily: "'Nunito', sans-serif", margin: 0 }}>
            My <span style={{ color: '#f97316' }}>Business</span>
          </h1>
          <p style={{ fontSize: 13, color: '#4a6080', fontWeight: 600, margin: 0, marginTop: 4, fontFamily: "'Nunito', sans-serif" }}>
            Manage your business profile, photos, menus, and public information
          </p>
        </Box>

        {/* Tabs */}
        <div className="ev-filter-bar">
          <div className="ev-tabs">
            {['Profile', 'Gallery', 'Menus', 'Member Lists'].map((label, i) => (
              <button key={label} className={`ev-tab${activeTab === i ? ' on' : ''}`} onClick={() => handleTabChange(i)}>{label}</button>
            ))}
          </div>
        </div>
        <style>{`
.ev-filter-bar{background:rgba(255,255,255,0.75);backdrop-filter:blur(18px) saturate(1.4);border:1.5px solid rgba(200,220,240,0.6);box-shadow:0 4px 20px rgba(0,100,180,0.06);border-radius:14px;padding:14px 18px;margin-bottom:16px;display:flex;gap:12px;align-items:center}
.ev-tabs{display:flex;gap:4px;background:rgba(0,80,160,0.06);padding:4px;border-radius:12px;flex:1;max-width:480px;overflow-x:auto;-webkit-overflow-scrolling:touch}
.ev-tab{padding:8px 14px;border:none;background:none;border-radius:9px;font-size:13px;font-weight:500;color:#5a738a;cursor:pointer;transition:all 0.22s cubic-bezier(.4,0,.2,1);font-family:'Outfit',sans-serif;white-space:nowrap;flex-shrink:0}
.ev-tab.on{background:#0077cc;color:#fff !important;font-weight:700;box-shadow:0 2px 8px rgba(0,119,204,0.25)}
.ev-tab:not(.on):hover{color:#0077cc}
        `}</style>

        {/* Tab 0: Profile */}
        {activeTab === 0 && (
          <Box sx={{ display: 'flex', gap: 3, flexDirection: { xs: 'column', md: 'row' } }}>
            {/* Left Panel - Image + QR */}
            <Box sx={{ width: { xs: '100%', md: '280px' }, flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
              {/* Cards Row */}
              <Box sx={{ display: 'flex', flexDirection: { xs: 'row', md: 'column' }, gap: 2, alignItems: 'stretch' }}>
                {/* Business Image Card */}
                <Box sx={{ flex: { xs: 1, md: 'none' }, backgroundColor: '#fff', borderRadius: '16px', padding: '16px', boxShadow: '0 2px 12px rgba(0,0,0,0.06)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minWidth: 0, gap: 1.5 }}>
                  <Box sx={{ width: '100%', flex: 1, borderRadius: '12px', overflow: 'hidden', backgroundColor: '#1a1a2e', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', minHeight: { xs: '100px', md: '160px' } }} onClick={() => { const src = uploadedImage || (item._id ? getBusinessPicture(item.userId || userId, 'full', item.iconUpdatedAt) : null); if (src) setLogoPreviewOpen(true); }}>
                    {(() => {
                      const logoSrc = uploadedImage || (item._id ? getBusinessPicture(item.userId || userId, 'full', item.iconUpdatedAt) : null);
                      return logoSrc ? (
                        <img src={logoSrc} alt={item.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      ) : (
                        <Typography sx={{ color: '#fff', fontSize: '20px', fontWeight: 800, fontFamily: 'Outfit' }}>{item.name || 'Business'}</Typography>
                      );
                    })()}
                  </Box>
                  {/* Submit button */}
                  <Button
                    variant="outlined"
                    component="label"
                    size="small"
                    sx={{ textTransform: 'none', borderRadius: '20px', borderColor: '#00AAD6', color: '#00AAD6', fontWeight: 600, fontSize: '12px', width: '100%', '&:hover': { backgroundColor: '#00AAD6', color: '#fff' } }}
                  >
                    Submit ↑
                    <input type="file" accept="image/*" hidden onChange={processFile} ref={inputref} />
                  </Button>
                </Box>

                {/* QR Code Card */}
                <Box sx={{ flex: { xs: 1, md: 'none' }, backgroundColor: '#fff', borderRadius: '16px', padding: '16px', boxShadow: '0 2px 12px rgba(0,0,0,0.06)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1.5, minWidth: 0 }}>
                <Box sx={{ position: 'relative', display: 'inline-flex' }}>
                  <QRCode
                    size={160}
                    style={{ height: "auto", maxWidth: "100%", width: { xs: '100px', md: '80%' } }}
                    value={item.businessCode ? `https://keeptabs.app/b/${item.businessCode}` : `https://keeptabs.app/business/${item._id}`}
                    id='QRCode'
                    viewBox={`0 0 256 256`}
                    level="H"
                  />
                  {/* Tabs Pin Logo Overlay */}
                  <Box sx={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', width: 36, height: 36, backgroundColor: '#fff', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '4px' }}>
                    <img src="/tabs-logo.svg" alt="Tabs" style={{ width: 28, height: 28 }} />
                  </Box>
                </Box>
                {item.businessCode && (
                  <Typography variant="caption" sx={{ fontFamily: 'monospace', color: '#666', fontSize: '11px' }}>
                    {item.businessCode}
                  </Typography>
                )}
                <Button
                  variant="outlined"
                  onClick={downloadQRPdf}
                  size="small"
                  sx={{ textTransform: 'none', borderRadius: '20px', borderColor: '#00AAD6', color: '#00AAD6', fontWeight: 600, fontSize: '12px', width: '100%', '&:hover': { backgroundColor: '#00AAD6', color: '#fff' } }}
                >
                  Print QR (PDF)
                </Button>
              </Box>
              </Box>
            </Box>

            {/* Right Panel - Business Profile Form */}
            <Box sx={{ flex: 1 }}>
              {(userRole === 'owner' || userRole === 'admin') ? (
              <SettingsCard
                title="Business Information"
                subtitle="Update your business details"
                dirty={isDirty}
                onSave={isDirty ? handleSave : undefined}
                onCancel={isDirty ? () => { setItem(JSON.parse(JSON.stringify(originalItem))); setSubcategories([...originalSubcategories]); setUploadedImage(null); } : undefined}
                headerAction={item.businessCode ? (
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '5px 12px', backgroundColor: '#F5F3FF', borderRadius: '8px', border: '1px solid #E9E5FF' }}>
                    <Typography sx={{ fontSize: '12px', fontWeight: 600, color: '#6B7280' }}>Business Code:</Typography>
                    <Typography sx={{ fontFamily: 'monospace', fontSize: '14px', fontWeight: 700, color: '#4F46E5', letterSpacing: '1px' }}>{item.businessCode}</Typography>
                    <Tooltip title={codeCopied ? 'Copied!' : 'Copy'}>
                      <IconButton size="small" onClick={() => handleCopyCode(item.businessCode)} sx={{ padding: '2px', color: codeCopied ? '#059669' : '#6B7280' }}>
                        <ContentCopyIcon sx={{ fontSize: '14px' }} />
                      </IconButton>
                    </Tooltip>
                  </Box>
                ) : undefined}
              >
                <Box>
                  {/* Form Fields - 2 column grid like Settings Profile */}
                  <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, gap: '16px' }}>
                    <SettingsFieldGroup label="Business Name">
                      <input type="text" value={item.name || ''}  onChange={(e) => handleItemChange('name', e.target.value)} placeholder="Business Name" style={inputStyle} />
                    </SettingsFieldGroup>

                    <SettingsFieldGroup label="Designation">
                      <input type="text" value={item.designation || ''}  onChange={(e) => handleItemChange('designation', e.target.value)} placeholder="Designation" style={inputStyle} />
                    </SettingsFieldGroup>

                    <SettingsFieldGroup label="Business Type">
                      <Select value={item.type || 'Entity/Individual'}  onChange={(e) => handleItemChange('type', e.target.value)} size="small" fullWidth
                        sx={{ borderRadius: '8px', fontSize: '14px', '& .MuiOutlinedInput-notchedOutline': { borderColor: '#E5E7EB' }, '& .MuiSelect-select': { padding: '9px 12px', fontSize: '14px' } }}>
                        {businessTypes.map(bt => <MenuItem key={bt.name} value={bt.name}>{bt.name}</MenuItem>)}
                      </Select>
                    </SettingsFieldGroup>

                    <SettingsFieldGroup label="Phone Number">
                      <input type="tel" value={formatPhone(item.phoneNumber || '')} onChange={(e) => handleItemChange('phoneNumber', unformatPhone(e.target.value))} placeholder="(281) 555-1234" style={inputStyle} />
                    </SettingsFieldGroup>

                    <SettingsFieldGroup label="Website">
                      <input type="url" value={item.website || ''}  onChange={(e) => handleItemChange('website', e.target.value)} placeholder="https://example.com" style={inputStyle} />
                    </SettingsFieldGroup>

                    <SettingsFieldGroup label="Show Location Info">
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 3, height: '38px' }}>
                        <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer', gap: '6px' }}>
                          <input type="radio" name="showLocation" checked={item.showLocation !== false}  onChange={() => handleItemChange('showLocation', true)} />
                          <span style={{ fontSize: '14px' }}>Yes</span>
                        </label>
                        <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer', gap: '6px' }}>
                          <input type="radio" name="showLocation" checked={item.showLocation === false}  onChange={() => handleItemChange('showLocation', false)} />
                          <span style={{ fontSize: '14px' }}>No</span>
                        </label>
                      </Box>
                    </SettingsFieldGroup>
                  </Box>

                  {/* Description - full width */}
                  <Box sx={{ mt: 2 }}>
                    <SettingsFieldGroup label="Description" description={`${item.description?.length || 0}/140 characters`}>
                      <textarea
                        style={{ ...inputStyle, height: '60px', resize: 'none',  }}
                        maxLength={140} value={item.description || ''} 
                        onChange={(e) => handleItemChange('description', (e.target.value || '').slice(0, 140))} placeholder="Description (140 characters)"
                      />
                    </SettingsFieldGroup>
                  </Box>

                  {/* Location - 2 column grid */}
                  <Box sx={{ mt: 2 }}>
                    <Typography sx={{ fontSize: '13px', fontWeight: 600, color: '#111827', mb: 1 }}>Location</Typography>
                    <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, gap: '16px' }}>
                      <Box sx={{ gridColumn: { xs: '1', md: '1 / -1' } }}>
                        <SettingsFieldGroup label="Address">
                          <input ref={addressInputRef} type="text" value={item.address1 || ''}  onChange={(e) => handleItemChange('address1', e.target.value)} placeholder="Start typing address..." style={inputStyle} />
                        </SettingsFieldGroup>
                      </Box>

                      {/* State, City, Zip Code on same row */}
                      <Box sx={{ gridColumn: { xs: '1', md: '1 / -1' }, display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr', md: '1fr 1fr 1fr' }, gap: '16px' }}>
                        <SettingsFieldGroup label="State">
                          <Select value={item.state || ''}  onChange={(e) => handleItemChange('state', e.target.value)} size="small" fullWidth displayEmpty
                            sx={{ borderRadius: '8px', fontSize: '14px', '& .MuiOutlinedInput-notchedOutline': { borderColor: '#E5E7EB' }, '& .MuiSelect-select': { padding: '9px 12px', fontSize: '14px' } }}>
                            <MenuItem value="" disabled>Select State</MenuItem>
                            {states.map(s => <MenuItem key={s.isoCode} value={s.name}>{s.name}</MenuItem>)}
                          </Select>
                        </SettingsFieldGroup>

                        <SettingsFieldGroup label="City">
                          <Select value={item.city || ''}  onChange={(e) => handleItemChange('city', e.target.value)} size="small" fullWidth displayEmpty
                            sx={{ borderRadius: '8px', fontSize: '14px', '& .MuiOutlinedInput-notchedOutline': { borderColor: '#E5E7EB' }, '& .MuiSelect-select': { padding: '9px 12px', fontSize: '14px' } }}>
                            <MenuItem value="" disabled>Select City</MenuItem>
                            {cities.map(c => <MenuItem key={c.name} value={c.name}>{c.name}</MenuItem>)}
                          </Select>
                        </SettingsFieldGroup>

                        <SettingsFieldGroup label="Zip Code">
                          <input type="text" value={item.zipCode || ''}  onChange={(e) => handleItemChange('zipCode', e.target.value)} placeholder="Zip Code" style={inputStyle} />
                        </SettingsFieldGroup>
                      </Box>
                    </Box>
                  </Box>

                  {/* Visibility - only show when business belongs to an organization */}
                  {hasOrganization && (
                  <Box sx={{ mt: 2 }}>
                    <Typography sx={{ fontSize: '13px', fontWeight: 600, color: '#111827', mb: 1 }}>Visibility</Typography>
                    <Box sx={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                      {[
                        { id: 'public', label: 'Public', desc: 'Visible to all Tabs users', icon: '🌐' },
                        { id: 'organization', label: 'Organization', desc: 'Visible to organization members only', icon: '🏢' }
                      ].map(v => (
                        <Box
                          key={v.id}
                          onClick={() => handleItemChange('visibility', v.id)}
                          sx={{
                            flex: 1,
                            minWidth: '140px',
                            background: (item.visibility || 'public') === v.id ? '#F0FDFF' : '#FFFFFF',
                            border: '1px solid',
                            borderColor: (item.visibility || 'public') === v.id ? '#00AAD6' : '#E5E7EB',
                            borderRadius: '8px',
                            padding: '14px 16px',
                            cursor: 'pointer',
                            transition: 'all 0.2s',
                            display: 'flex',
                            alignItems: 'flex-start',
                            gap: '10px',
                            boxShadow: (item.visibility || 'public') === v.id ? '0 0 0 2px rgba(0,170,214,.12)' : 'none',
                            '&:hover': { background: (item.visibility || 'public') === v.id ? '#F0FDFF' : '#FAFBFC', borderColor: (item.visibility || 'public') === v.id ? '#00AAD6' : '#D1D5DB' }
                          }}
                        >
                          <Box sx={{
                            width: '18px',
                            height: '18px',
                            borderRadius: '50%',
                            border: '2px solid',
                            borderColor: (item.visibility || 'public') === v.id ? '#00AAD6' : '#D1D5DB',
                            flexShrink: 0,
                            marginTop: '1px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center'
                          }}>
                            {(item.visibility || 'public') === v.id && (
                              <Box sx={{ width: '8px', height: '8px', borderRadius: '50%', background: '#00AAD6' }} />
                            )}
                          </Box>
                          <Box>
                            <Typography sx={{ fontSize: '13.5px', fontWeight: 700, color: '#111827' }}>{v.icon} {v.label}</Typography>
                            <Typography sx={{ fontSize: '11.5px', color: '#6B7280', marginTop: '2px' }}>{v.desc}</Typography>
                          </Box>
                        </Box>
                      ))}
                    </Box>
                  </Box>
                  )}

                  {/* Categories */}
                  <Box sx={{ mt: 2 }}>
                    <Typography sx={{ fontSize: '13px', fontWeight: 600, color: '#111827', mb: 1 }}>Categories</Typography>
                    
                    {/* Show currently selected categories */}
                    {subcategories.length > 0 && (
                      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: '8px', mb: 2 }}>
                        {subcategories.map(cat => (
                          <Chip
                            key={cat}
                            label={cat}
                            size="small"
                            onDelete={() => setSubcategories(subcategories.filter(c => c !== cat))}
                            sx={{
                              backgroundColor: '#00BCD4', color: '#fff', fontWeight: 600, fontSize: '12px',
                              '& .MuiChip-deleteIcon': { color: 'rgba(255,255,255,0.7)', '&:hover': { color: '#fff' } }
                            }}
                          />
                        ))}
                        <Typography sx={{ fontSize: '12px', color: subcategories.length >= 3 ? '#e53935' : '#6B7280', alignSelf: 'center' }}>
                          {subcategories.length}/3
                        </Typography>
                      </Box>
                    )}

                    {/* Category type selector */}
                    {subcategories.length < 3 && (
                      <>
                        <Autocomplete
                          options={categoriesJS.map(cat => cat.name)}
                          value={selectedCategoryType || null}
                          onChange={(e, newValue) => {
                            setSelectedCategoryType(newValue || '');
                            // If the selected category has no subcategories, add it directly
                            if (newValue) {
                              const cat = categoriesJS.find(c => c.name === newValue);
                              if (cat && (!cat.subcategories || cat.subcategories.length === 0)) {
                                if (!subcategories.includes(newValue) && subcategories.length < 3) {
                                  setSubcategories([...subcategories, newValue]);
                                }
                                setSelectedCategoryType('');
                              }
                            }
                          }}
                          renderInput={(params) => (
                            <TextField
                              {...params}
                              label="Designation / Type"
                              placeholder="Start typing to search..."
                              size="small"
                              InputProps={{ ...params.InputProps, sx: { borderRadius: '8px' } }}
                            />
                          )}
                          sx={{ mb: 1 }}
                          size="small"
                        />
                        {selectedCategoryType && (() => {
                          const selectedCat = categoriesJS.find(c => c.name === selectedCategoryType);
                          const subcats = selectedCat?.subcategories || [];
                          if (subcats.length === 0) return null;
                          return (
                            <Box sx={{ mb: 1 }}>
                              <Typography sx={{ fontSize: '12px', fontWeight: 600, color: '#374151', mb: 0.5 }}>
                                Pick a subcategory:
                              </Typography>
                              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                                {subcats.map(sub => {
                                  const isSelected = subcategories.includes(sub);
                                  const isDisabled = !isSelected && subcategories.length >= 3;
                                  return (
                                    <Chip
                                      key={sub}
                                      label={sub}
                                      size="small"
                                      clickable={!isDisabled}
                                      onClick={() => {
                                        if (isSelected) {
                                          setSubcategories(subcategories.filter(c => c !== sub));
                                        } else if (subcategories.length < 3) {
                                          setSubcategories([...subcategories, sub]);
                                        }
                                      }}
                                      sx={{
                                        backgroundColor: isSelected ? '#00BCD4' : '#F3F4F6',
                                        color: isSelected ? '#fff' : isDisabled ? '#D1D5DB' : '#374151',
                                        fontWeight: 500, fontSize: '12px',
                                        cursor: isDisabled ? 'not-allowed' : 'pointer',
                                        '&:hover': { backgroundColor: isSelected ? '#00ACC1' : isDisabled ? '#F3F4F6' : '#E5E7EB' },
                                      }}
                                    />
                                  );
                                })}
                              </Box>
                            </Box>
                          );
                        })()}
                      </>
                    )}
                  </Box>
                </Box>
              </SettingsCard>
              ) : (
              /* Read-only view for members */
              <Box sx={{ backgroundColor: '#fff', borderRadius: '16px', padding: '24px', boxShadow: '0 2px 12px rgba(0,0,0,0.06)' }}>
                <Typography sx={{ fontSize: '16px', fontWeight: 700, color: '#111827', marginBottom: '4px', fontFamily: 'Outfit' }}>Business Information</Typography>
                <Typography sx={{ fontSize: '13px', color: '#6B7280', marginBottom: '20px', fontFamily: 'Outfit' }}>You have view-only access to this business</Typography>
                <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, gap: '16px' }}>
                  {[
                    { label: 'Business Name', value: item.name },
                    { label: 'Designation', value: item.designation },
                    { label: 'Business Type', value: item.type },
                    { label: 'Phone Number', value: item.phoneNumber },
                    { label: 'Website', value: item.website },
                    { label: 'Address', value: item.address1 },
                    { label: 'City', value: item.city },
                    { label: 'State', value: item.state },
                    { label: 'Zip Code', value: item.zipCode },
                  ].map(field => (
                    <Box key={field.label}>
                      <Typography sx={{ fontSize: '12px', fontWeight: 600, color: '#6B7280', marginBottom: '4px', fontFamily: 'Outfit' }}>{field.label}</Typography>
                      <Typography sx={{ fontSize: '14px', fontWeight: 500, color: '#111827', fontFamily: 'Outfit', padding: '8px 0', borderBottom: '1px solid #F3F4F6' }}>{field.value || '—'}</Typography>
                    </Box>
                  ))}
                </Box>
                {item.description && (
                  <Box sx={{ marginTop: '16px' }}>
                    <Typography sx={{ fontSize: '12px', fontWeight: 600, color: '#6B7280', marginBottom: '4px', fontFamily: 'Outfit' }}>Description</Typography>
                    <Typography sx={{ fontSize: '14px', fontWeight: 500, color: '#111827', fontFamily: 'Outfit', lineHeight: 1.6 }}>{item.description}</Typography>
                  </Box>
                )}
              </Box>
              )}
            </Box>
          </Box>
        )}

        {/* Tab 1: Gallery */}
        {activeTab === 1 && (
          userRole === 'member' ? (
            <GalleryTab item={item} photoGallery={photoGallery} readOnly />
          ) : (
          <GalleryTab
            item={item}
            photoGallery={photoGallery}
            onLabelChange={(idx, value) => handleItemChange(`photoGalleryLabel${idx + 1}`, value)}
            onPhotoUpload={handlePhotoUpload}
            onRemovePhoto={removePhoto}
          />
          )
        )}

        {/* Tab 2: Menus */}
        {activeTab === 2 && (
          userRole === 'member' ? (
            <MenusTab item={item} readOnly />
          ) : (
          <MenusTab item={item} onLabelChange={(menuNum, value) => handleItemChange(`menuLabel${menuNum}`, value)} onMenuUpload={handleMenuUpload} onRemoveMenu={(menuNum) => handleItemChange(`menuUrl${menuNum}`, null)} />
          )
        )}

        {/* Tab 3: Member Lists */}
        {activeTab === 3 && (
          <MemberListsTab selectedBusinessId={selectedBusinessId} userRole={userRole} />
        )}

        {/* Floating Save Bar - appears on any tab when dirty (only for owner/admin) */}
        {isDirty && activeTab !== 0 && (userRole === 'owner' || userRole === 'admin') && (
          <Box sx={{ position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)', backgroundColor: '#fff', borderRadius: '12px', boxShadow: '0 4px 24px rgba(0,0,0,0.15)', padding: '12px 24px', display: 'flex', alignItems: 'center', gap: 2, zIndex: 1000, border: '1px solid #E5E7EB' }}>
            <Box sx={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: '#F59E0B' }} />
            <Typography sx={{ fontSize: '14px', color: '#374151', fontWeight: 500 }}>You have unsaved changes</Typography>
            <Button onClick={() => { setItem(JSON.parse(JSON.stringify(originalItem))); setSubcategories([...originalSubcategories]); setUploadedImage(null); setMenuFiles({ menu1: null, menu2: null, menu3: null, menu4: null }); init(selectedBusinessId); }}
              variant="outlined" size="small" sx={{ textTransform: 'none', borderRadius: '8px', borderColor: '#E5E7EB', color: '#6B7280' }}>
              Cancel
            </Button>
            <Button onClick={handleSave} variant="contained" size="small" disableElevation
              sx={{ textTransform: 'none', borderRadius: '8px', backgroundColor: '#4F46E5', fontWeight: 600, '&:hover': { backgroundColor: '#4338CA' } }}>
              Save Changes
            </Button>
          </Box>
        )}
      </Box>

      {/* Logo Preview Dialog */}
      <Dialog open={logoPreviewOpen} onClose={() => setLogoPreviewOpen(false)} maxWidth="md" PaperProps={{ sx: { borderRadius: '12px', overflow: 'hidden', background: '#000' } }}>
        <Box sx={{ position: 'relative' }}>
          <IconButton onClick={() => setLogoPreviewOpen(false)} sx={{ position: 'absolute', top: 8, right: 8, color: '#fff', backgroundColor: 'rgba(0,0,0,0.5)', '&:hover': { backgroundColor: 'rgba(0,0,0,0.7)' } }}>
            <CloseIcon />
          </IconButton>
          <img
            src={uploadedImage || getBusinessPicture(item.userId || userId, 'full', item.iconUpdatedAt)}
            alt={item.name}
            style={{ display: 'block', maxWidth: '80vw', maxHeight: '80vh', objectFit: 'contain' }}
          />
        </Box>
      </Dialog>
    </Box>
  );
};

export default MyBusiness;
