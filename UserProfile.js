import React, { useState } from 'react';

export default function UserProfile({ user }) {
  const [isEditing, setIsEditing] = useState(false);
  const [profile, setProfile] = useState(user);

  const handleSave = () => {
    // Save profile changes
    setIsEditing(false);
    console.log('Profile saved:', profile);
  };

  return (
    <div className="user-profile">
      <h2>{profile.name}</h2>
      <p>{profile.email}</p>
      {isEditing ? (
        <button onClick={handleSave}>Save Changes</button>
      ) : (
        <button onClick={() => setIsEditing(true)}>Edit Profile</button>
      )}
    </div>
  );
}