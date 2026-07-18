import React, { useEffect, useRef, useState } from 'react';
import {
  User,
  Building2,
  Mail,
  Phone,
  Briefcase,
  MapPin,
  Shield,
  Calendar,
  ChevronDown,
  Save,
  Pencil,
  Camera,
  ImagePlus,
  Loader2,
  LogOut
} from 'lucide-react';
import type { UserProfile } from '../security/roleAccess';
import { useModal } from './NotificationModal';
import { useBreadcrumbTail } from './Breadcrumbs';

interface ProfileViewProps {
  currentUser: UserProfile;
  initialTab?: string;
  /** Shared profile-photo object URL, loaded once by App and kept in sync across the app. */
  avatarObjectUrl?: string | null;
  onUserUpdated: (user: UserProfile) => void;
  /** Signs the user out and returns to the login screen. */
  onLogout?: () => void;
}

// Colleagues pool for the "Recommend a person (AD)" dropdown
const COLLEAGUE_OPTIONS = [
  'Select Colleague',
  'Adrian Ferreira',
  'Naledi Khumalo',
  'Themba Dlamini',
  'Priya Naidoo',
  'Johan van der Berg',
  'Ayanda Mthembu',
  'Ronel Pretorius',
  'Sipho Molefe',
];

const authFetch = (url: string, currentUser: UserProfile, options: RequestInit = {}) =>
  fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {}),
      'x-username': currentUser.username,
      'x-user-role': currentUser.role,
    },
  });

const MAX_AVATAR_BYTES = 5 * 1024 * 1024; // keep in step with the server limit
const ALLOWED_AVATAR_TYPES = ['image/png', 'image/jpeg', 'image/gif', 'image/webp', 'image/bmp', 'image/heic'];

const readFileAsDataUrl = (file: File): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error('Could not read the selected file'));
    reader.readAsDataURL(file);
  });

// ---------- Info Field ----------
const InfoField: React.FC<{
  icon: React.ElementType;
  label: string;
  value: string;
}> = ({ icon: Icon, label, value }) => (
  <div className="pv-info-field">
    <span className="pv-info-field-icon-wrap">
      <Icon size={15} className="pv-info-field-icon" />
    </span>
    <div className="pv-info-field-body">
      <span className="pv-info-field-label">{label}</span>
      <span className="pv-info-field-value">{value || '—'}</span>
    </div>
  </div>
);

// ---------- Supervisor label by role ----------
const getSupervisorLabel = (role: UserProfile['role']): string => {
  switch (role) {
    case 'employee': return 'Security Coordinator';
    case 'security_coordinator': return 'Chief Security Director';
    case 'chief_security_investigator': return 'Chief Security Director';
    case 'deputy_director': return 'Chief Security Director';
    case 'security_director': return 'Director-General';
    case 'system_administrator': return 'Chief Security Director';
    default: return 'Line Manager';
  }
};

// ---------- Acting section title by role ----------
const getActingTitle = (role: UserProfile['role']): string => {
  switch (role) {
    case 'security_director': return 'Acting Chief Director';
    case 'system_administrator': return 'Acting Security Coordinator';
    default: return 'Acting Security Coordinator';
  }
};

// Roles that show the acting delegation section
const ACTING_ROLES: Array<UserProfile['role']> = [
  'security_coordinator',
  'security_director',
  'system_administrator',
];

export const ProfileView: React.FC<ProfileViewProps> = ({ currentUser, avatarObjectUrl, onUserUpdated, onLogout }) => {
  const { showAlert } = useModal();
  useBreadcrumbTail('Profile');

  const [isEditing, setIsEditing] = useState(false);
  const [jobTitle, setJobTitle] = useState(currentUser.jobTitle || '');
  const [phoneNumber, setPhoneNumber] = useState(currentUser.phoneNumber || '');
  const [saving, setSaving] = useState(false);

  // Profile photo state. The shared photo (avatarObjectUrl) is loaded and kept in
  // sync by App; localPreview is the just-picked image, shown instantly on upload
  // until the shared object URL catches up.
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [localPreview, setLocalPreview] = useState<string | null>(null);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);

  const avatarSrc = localPreview || avatarObjectUrl || null;

  // Once the shared photo reflects a new upload, drop the local preview override.
  useEffect(() => {
    if (avatarObjectUrl) setLocalPreview(null);
  }, [avatarObjectUrl]);

  const handlePickPhoto = () => fileInputRef.current?.click();

  const handleAvatarSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = ''; // allow re-selecting the same file later
    if (!file) return;

    if (!ALLOWED_AVATAR_TYPES.includes(file.type)) {
      showAlert('Please choose an image file (PNG, JPG, GIF, WEBP, BMP or HEIC).', 'Unsupported File', 'warning');
      return;
    }
    if (file.size > MAX_AVATAR_BYTES) {
      showAlert('Profile photos must be 5 MB or smaller. Please choose a smaller image.', 'Image Too Large', 'warning');
      return;
    }

    setUploadingAvatar(true);
    try {
      const dataUrl = await readFileAsDataUrl(file);
      const res = await authFetch('/api/auth/avatar', currentUser, {
        method: 'PUT',
        body: JSON.stringify({ fileName: file.name, mimeType: file.type, dataBase64: dataUrl }),
      });
      const json = await res.json();
      if (json.success && json.data) {
        // Show the just-picked image immediately; App re-fetches the shared photo
        // from the new stored path and every avatar updates in step.
        setLocalPreview(dataUrl);
        onUserUpdated(json.data);
        showAlert('Your profile photo has been updated.', 'Photo Updated', 'success');
      } else {
        showAlert(json.message || json.error || 'Failed to update profile photo.', 'Upload Failed', 'danger');
      }
    } catch {
      showAlert('Could not upload the image. Please try again.', 'Upload Failed', 'danger');
    } finally {
      setUploadingAvatar(false);
    }
  };

  // Acting section state
  const [leaveFrom, setLeaveFrom] = useState('');
  const [leaveTo, setLeaveTo] = useState('');
  const [selectedColleague, setSelectedColleague] = useState('Select Colleague');
  const [submittingActing, setSubmittingActing] = useState(false);

  const canAct = ACTING_ROLES.includes(currentUser.role);
  const actingTitle = getActingTitle(currentUser.role);

  const handleSaveProfile = async () => {
    setSaving(true);
    try {
      const res = await authFetch('/api/auth/profile', currentUser, {
        method: 'PUT',
        body: JSON.stringify({ phoneNumber, jobTitle }),
      });
      const json = await res.json();
      if (json.success && json.data) {
        onUserUpdated(json.data);
        showAlert('Your personal details have been updated.', 'Profile Updated', 'success');
        setIsEditing(false);
      } else {
        showAlert(json.message || json.error || 'Failed to update profile.', 'Update Failed', 'danger');
      }
    } catch {
      showAlert('Could not reach the server. Please try again.', 'Update Failed', 'danger');
    } finally {
      setSaving(false);
    }
  };

  const handleSubmitActing = async () => {
    if (!leaveFrom || !leaveTo || selectedColleague === 'Select Colleague') {
      showAlert('Please fill in all acting delegation fields before submitting.', 'Missing Fields', 'warning');
      return;
    }
    setSubmittingActing(true);
    try {
      // In production this would POST to /api/leave/acting-request
      await new Promise(r => setTimeout(r, 800));
      showAlert(
        `Your acting delegation request has been submitted for Chief Director's approval. Stand-in: ${selectedColleague}`,
        'Submitted for Approval',
        'success'
      );
      setLeaveFrom('');
      setLeaveTo('');
      setSelectedColleague('Select Colleague');
    } finally {
      setSubmittingActing(false);
    }
  };

  return (
    <div className="pv-page">
      {/* ===== Banner + Avatar ===== */}
      <div className="pv-banner-wrap">
        <div className="pv-banner" />
        <div className="pv-avatar-row">
          <div className="pv-avatar-circle">
            {avatarSrc ? (
              <img src={avatarSrc} alt={`${currentUser.displayName} profile photo`} className="pv-avatar-img" />
            ) : (
              <User size={40} strokeWidth={1.5} />
            )}

            {uploadingAvatar && (
              <div className="pv-avatar-uploading">
                <Loader2 size={22} className="pv-avatar-spinner" />
              </div>
            )}

            {/* Add when there's no photo yet; Edit (camera) once one exists — the icon
                signals the photo can be changed. Available to every role. */}
            <button
              type="button"
              className={`pv-avatar-photo-btn${avatarSrc ? ' pv-avatar-photo-btn--edit' : ' pv-avatar-photo-btn--add'}`}
              onClick={handlePickPhoto}
              disabled={uploadingAvatar}
              title={avatarSrc ? 'Change profile photo' : 'Add profile photo'}
              aria-label={avatarSrc ? 'Change profile photo' : 'Add profile photo'}
            >
              {avatarSrc ? <Camera size={15} /> : <ImagePlus size={15} />}
            </button>

            <input
              ref={fileInputRef}
              type="file"
              accept="image/png,image/jpeg,image/gif,image/webp,image/bmp,image/heic"
              className="pv-avatar-file-input"
              onChange={handleAvatarSelected}
            />
          </div>
          <div className="pv-avatar-meta">
            <h2 className="pv-display-name" style={{ textTransform: 'capitalize' }}>
              {currentUser.displayName}
            </h2>
            <p className="pv-display-role">{currentUser.roleLabel}</p>
          </div>
          <div className="pv-avatar-actions">
            {isEditing ? (
              <>
                <button
                  className="pv-edit-btn"
                  onClick={handleSaveProfile}
                  disabled={saving}
                >
                  <Save size={15} />
                  {saving ? 'Saving…' : 'Save Changes'}
                </button>
                <button
                  className="pv-cancel-btn"
                  onClick={() => { setIsEditing(false); setJobTitle(currentUser.jobTitle || ''); setPhoneNumber(currentUser.phoneNumber || ''); }}
                >
                  Cancel
                </button>
              </>
            ) : (
              <>
                <button className="pv-edit-btn" onClick={() => setIsEditing(true)}>
                  <Pencil size={15} />
                  Edit Profile
                </button>
                {onLogout && (
                  <button className="pv-logout-btn" onClick={onLogout}>
                    <LogOut size={15} />
                    Logout
                  </button>
                )}
              </>
            )}
          </div>
        </div>
      </div>

      {/* ===== Personal Information Card ===== */}
      <div className="pv-card">
        <h3 className="pv-card-title">Personal Information</h3>
        <div className="pv-info-grid">
          <InfoField icon={User} label="Full name" value={currentUser.displayName} />
          <InfoField
            icon={Building2}
            label="Department"
            value={currentUser.directorate || 'DLRRD — Security & Facilities'}
          />
          <InfoField icon={Mail} label="Email" value={currentUser.email} />
          <InfoField icon={Phone} label="PHONE" value={currentUser.phoneNumber || ''} />

          {/* Job Title — editable when editing */}
          {isEditing ? (
            <div className="pv-info-field pv-info-field--editable">
              <span className="pv-info-field-icon-wrap">
                <Briefcase size={15} className="pv-info-field-icon" />
              </span>
              <div className="pv-info-field-body">
                <span className="pv-info-field-label">Job Title</span>
                <input
                  className="pv-inline-input"
                  value={jobTitle}
                  maxLength={100}
                  onChange={e => setJobTitle(e.target.value)}
                  placeholder="e.g. Senior Security Supervisor"
                />
              </div>
            </div>
          ) : (
            <InfoField icon={Briefcase} label="Job Title" value={currentUser.jobTitle || ''} />
          )}

          <InfoField
            icon={User}
            label="Supervisor / Line Manager"
            value={getSupervisorLabel(currentUser.role)}
          />

          <InfoField icon={MapPin} label="PROVINCE" value={currentUser.province} />
          <InfoField icon={Shield} label="Role" value={currentUser.roleLabel} />
        </div>

        {/* Editable phone number row */}
        {isEditing && (
          <div className="pv-info-grid" style={{ marginTop: '0.75rem' }}>
            <div className="pv-info-field pv-info-field--editable">
              <span className="pv-info-field-icon-wrap">
                <Phone size={15} className="pv-info-field-icon" />
              </span>
              <div className="pv-info-field-body">
                <span className="pv-info-field-label">Work Contact Number</span>
                <input
                  className="pv-inline-input"
                  value={phoneNumber}
                  maxLength={25}
                  onChange={e => setPhoneNumber(e.target.value)}
                  placeholder="e.g. 012 312 8600"
                />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ===== Acting Delegation Card (role-conditional) ===== */}
      {canAct && (
        <div className="pv-card pv-acting-card">
          <h3 className="pv-acting-title">{actingTitle}</h3>
          <p className="pv-acting-subtitle">
            Nominate a stand-in during leave. Requires Director approval.
          </p>

          <div className="pv-acting-form">
            <div className="pv-acting-field">
              <label className="pv-acting-label">Leave from</label>
              <div className="pv-date-input-wrap">
                <input
                  type="date"
                  className="pv-date-input"
                  value={leaveFrom}
                  onChange={e => setLeaveFrom(e.target.value)}
                  placeholder="yyyy / mm / dd"
                />
                <Calendar size={14} className="pv-date-icon" />
              </div>
            </div>

            <div className="pv-acting-field">
              <label className="pv-acting-label">Leave to</label>
              <div className="pv-date-input-wrap">
                <input
                  type="date"
                  className="pv-date-input"
                  value={leaveTo}
                  onChange={e => setLeaveTo(e.target.value)}
                  placeholder="yyyy / mm / dd"
                />
                <Calendar size={14} className="pv-date-icon" />
              </div>
            </div>

            <div className="pv-acting-field">
              <label className="pv-acting-label">Recommend a person (AD)</label>
              <div className="pv-select-wrap">
                <select
                  className="pv-select"
                  value={selectedColleague}
                  onChange={e => setSelectedColleague(e.target.value)}
                >
                  {COLLEAGUE_OPTIONS.map(opt => (
                    <option key={opt} value={opt}>
                      {opt}
                    </option>
                  ))}
                </select>
                <ChevronDown size={14} className="pv-select-chevron" />
              </div>
            </div>
          </div>

          <div className="pv-acting-actions">
            <button className="pv-upload-btn" type="button">
              Upload Document
            </button>
            <button
              className="pv-submit-btn"
              type="button"
              onClick={handleSubmitActing}
              disabled={submittingActing}
            >
              <User size={15} />
              {submittingActing ? 'Submitting…' : "Submit for Chief Director's approval"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
