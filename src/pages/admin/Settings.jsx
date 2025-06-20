import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'react-hot-toast';
import { doc, updateDoc, onSnapshot } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import { db, storage } from '../../firebase/config';
import { useAuth } from '../../context/AuthContext';
import DashboardLayout from '../../components/layout/DashboardLayout';
import Input from '../../components/ui/Input';
import Button from '../../components/ui/Button';
import ImageUpload from '../../components/ui/ImageUpload';
import { UserCircle, Save, Shield } from 'lucide-react';

function AdminSettings() {
  const { currentUser } = useAuth();
  const { register, handleSubmit, setValue, formState: { errors }, watch } = useForm();
  const [loading, setLoading] = useState(false);
  const [imageLoading, setImageLoading] = useState(false);
  const [profileData, setProfileData] = useState(null);
  const [initialData, setInitialData] = useState(null);
  const [hasChanges, setHasChanges] = useState(false);

  const watchedFields = watch();

  useEffect(() => {
    if (!currentUser) return;

    const unsubscribe = onSnapshot(
      doc(db, 'users', currentUser.uid),
      (doc) => {
        if (doc.exists()) {
          const data = doc.data();
          setProfileData(data);
          
          setValue('name', data.name || '');
          setValue('email', data.email || currentUser.email || '');
          setValue('address', data.address || '');
          setValue('department', data.department || '');
          
          if (!initialData) {
            setInitialData({
              name: data.name || '',
              address: data.address || '',
              department: data.department || ''
            });
          }
        }
      },
      (error) => {
        console.error('Error fetching profile:', error);
        toast.error('Failed to load profile data');
      }
    );

    return () => unsubscribe();
  }, [currentUser, setValue, initialData]);

  useEffect(() => {
    if (initialData && watchedFields) {
      const currentFormData = {
        name: watchedFields.name || '',
        address: watchedFields.address || '',
        department: watchedFields.department || ''
      };
      
      const hasFormChanges = Object.keys(currentFormData).some(
        key => currentFormData[key] !== initialData[key]
      );
      
      setHasChanges(hasFormChanges);
    }
  }, [watchedFields, initialData]);

  const handleImageUpload = async (file, setProgress) => {
    if (!currentUser) return;

    try {
      setImageLoading(true);
      setProgress(0);

      // Delete old image if exists
      if (profileData?.profileImageRef) {
        try {
          const oldImageRef = ref(storage, profileData.profileImageRef);
          await deleteObject(oldImageRef);
        } catch (error) {
          console.warn('Old image not found in storage:', error);
        }
      }

      // Create unique filename
      const timestamp = Date.now();
      const fileExtension = file.name.split('.').pop();
      const fileName = `${currentUser.uid}_${timestamp}.${fileExtension}`;
      const imageRef = ref(storage, `profile-images/${fileName}`);
      
      setProgress(25);

      // Upload with metadata
      const metadata = {
        contentType: file.type,
        customMetadata: {
          uploadedBy: currentUser.uid,
          uploadedAt: new Date().toISOString(),
          originalName: file.name
        }
      };

      setProgress(50);
      const uploadResult = await uploadBytes(imageRef, file, metadata);
      
      setProgress(75);
      const imageUrl = await getDownloadURL(uploadResult.ref);

      setProgress(90);
      await updateDoc(doc(db, 'users', currentUser.uid), {
        profileImage: imageUrl,
        profileImageRef: `profile-images/${fileName}`,
        profileImageName: file.name,
        updatedAt: new Date().toISOString()
      });

      setProgress(100);
      toast.success('Profile image updated successfully');
    } catch (error) {
      console.error('Error uploading image:', error);
      toast.error('Failed to upload image. Please try again.');
    } finally {
      setImageLoading(false);
      setTimeout(() => setProgress(0), 1000);
    }
  };

  const handleImageRemove = async () => {
    if (!currentUser || !profileData?.profileImage) return;

    try {
      setImageLoading(true);
      
      if (profileData.profileImageRef) {
        try {
          const imageRef = ref(storage, profileData.profileImageRef);
          await deleteObject(imageRef);
        } catch (storageError) {
          console.warn('Storage file may not exist:', storageError);
        }
      }

      await updateDoc(doc(db, 'users', currentUser.uid), {
        profileImage: null,
        profileImageRef: null,
        profileImageName: null,
        updatedAt: new Date().toISOString()
      });

      toast.success('Profile image removed successfully');
    } catch (error) {
      console.error('Error removing image:', error);
      toast.error('Failed to remove image. Please try again.');
    } finally {
      setImageLoading(false);
    }
  };

  const onSubmit = async (data) => {
    if (!currentUser) return;

    try {
      setLoading(true);
      
      const updateData = {
        name: data.name.trim(),
        address: data.address.trim(),
        department: data.department.trim(),
        updatedAt: new Date().toISOString()
      };

      await updateDoc(doc(db, 'users', currentUser.uid), updateData);

      setInitialData({
        name: updateData.name,
        address: updateData.address,
        department: updateData.department
      });

      toast.success('Profile updated successfully');
    } catch (error) {
      console.error('Error updating profile:', error);
      toast.error('Failed to update profile. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (!profileData) {
    return (
      <DashboardLayout title="Admin Settings">
        <div className="flex justify-center items-center h-64">
          <div className="h-8 w-8 border-4 border-primary-500 border-t-transparent rounded-full animate-spin"></div>
          <span className="ml-3 text-gray-600">Loading profile...</span>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout title="Admin Settings">
      <div className="max-w-2xl mx-auto bg-white rounded-lg shadow-soft p-6 animate-fade-in">
        <div className="flex items-center mb-6">
          <Shield size={24} className="text-primary-600 mr-2" />
          <h2 className="text-xl font-semibold text-gray-800">Admin Profile Settings</h2>
        </div>

        <div className="mb-8">
          <ImageUpload
            currentImage={profileData?.profileImage}
            onImageUpload={handleImageUpload}
            onImageRemove={handleImageRemove}
            loading={imageLoading}
          />
        </div>

        <form onSubmit={handleSubmit(onSubmit)}>
          <div className="space-y-4">
            <Input
              label="Full Name"
              {...register('name', { 
                required: 'Name is required',
                minLength: { value: 2, message: 'Name must be at least 2 characters' }
              })}
              error={errors.name?.message}
              placeholder="Enter your full name"
            />

            <Input
              label="Email"
              value={currentUser?.email || ''}
              disabled
              className="bg-gray-50"
              placeholder="Email address"
            />

            <Input
              label="Department"
              {...register('department', { 
                required: 'Department is required'
              })}
              error={errors.department?.message}
              placeholder="e.g., IT, Administration, Academic Affairs"
            />

            <Input
              label="Address"
              {...register('address')}
              placeholder="Your home address"
            />
          </div>

          <div className="mt-6 flex gap-4">
            <Button
              type="submit"
              variant="primary"
              className="flex-1 flex items-center justify-center"
              disabled={loading || !hasChanges}
            >
              {loading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></div>
                  Saving...
                </>
              ) : (
                <>
                  <Save size={16} className="mr-2" />
                  Save Changes
                </>
              )}
            </Button>
            
            {hasChanges && (
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setValue('name', initialData.name);
                  setValue('address', initialData.address);
                  setValue('department', initialData.department);
                }}
                disabled={loading}
              >
                Reset
              </Button>
            )}
          </div>
          
          {hasChanges && (
            <p className="text-sm text-amber-600 mt-2 text-center">
              You have unsaved changes
            </p>
          )}
        </form>
      </div>
    </DashboardLayout>
  );
}

export default AdminSettings;
