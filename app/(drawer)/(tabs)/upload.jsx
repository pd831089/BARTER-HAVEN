import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    TextInput,
    TouchableOpacity,
    StyleSheet,
    ScrollView,
    Image,
    Alert,
    ActivityIndicator,
    Modal,
    Dimensions,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system';
import { Ionicons, Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { supabase } from '@/Config/supabaseConfig';
import { router } from 'expo-router';
import { decode as atob } from 'base-64';
import { categories as categoryList } from '@/Config/categories';
import { LinearGradient } from 'expo-linear-gradient';
import LocationPicker from '@/app/components/LocationPicker';

const { width } = Dimensions.get('window');
const categories = categoryList.map(cat => cat.name);

export default function UploadScreen({ navigation }) {
    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    const [image, setImage] = useState(null);
    const [category, setCategory] = useState('');
    const [loading, setLoading] = useState(false);
    const [showCategoryModal, setShowCategoryModal] = useState(false);
    const [uploadProgress, setUploadProgress] = useState(0);
    const [offering, setOffering] = useState('');
    const [exchangefor, setExchangefor] = useState('');
    const [bartertype, setBartertype] = useState('Online Barter');
    const [errorMsg, setErrorMsg] = useState('');
    const [barterTypes, setBarterTypes] = useState(['Online Barter', 'In-Person Barter']);
    const [currentStep, setCurrentStep] = useState(1);
    const [billDocument, setBillDocument] = useState(null);
    const [billDocumentName, setBillDocumentName] = useState('');
    const [billUploading, setBillUploading] = useState(false);
    const [itemLocation, setItemLocation] = useState(null);

    const takePhoto = async () => {
        try {
            const { status } = await ImagePicker.requestCameraPermissionsAsync();
            if (status !== 'granted') {
                Alert.alert('Permission needed', 'Please grant camera permissions to take photos');
                return;
            }

            const result = await ImagePicker.launchCameraAsync({
                allowsEditing: true,
                aspect: [4, 3],
                quality: 0.8,
            });

            if (!result.canceled) {
                setImage(result.assets[0].uri);
            }
        } catch (error) {
            Alert.alert('Error', 'Failed to take photo');
        }
    };

    const pickImage = async () => {
        try {
            const result = await ImagePicker.launchImageLibraryAsync({
                type: 'image',
                allowsEditing: true,
                aspect: [4, 3],
                quality: 0.8,
            });

            if (!result.canceled) {
                setImage(result.assets[0].uri);
            }
        } catch (error) {
            Alert.alert('Error', 'Failed to pick image');
        }
    };

    const showImagePickerOptions = () => {
        Alert.alert(
            'Select Image Source',
            'Choose where to get the image from',
            [
                {
                    text: 'Camera',
                    onPress: takePhoto,
                },
                {
                    text: 'Gallery',
                    onPress: pickImage,
                },
                {
                    text: 'Cancel',
                    style: 'cancel',
                },
            ]
        );
    };

    const uploadImage = async (uri, isDocument = false) => {
        try {
            if (!uri.startsWith('file://')) {
                throw new Error('Invalid file URI format');
            }

            // Read file as base64
            const base64 = await FileSystem.readAsStringAsync(uri, { encoding: FileSystem.EncodingType.Base64 });

            // Convert base64 to Uint8Array
            const binaryString = atob(base64);
            const len = binaryString.length;
            const bytes = new Uint8Array(len);
            for (let i = 0; i < len; i++) {
                bytes[i] = binaryString.charCodeAt(i);
            }

            // Generate unique filename with proper extension detection
            const fileName = uri.split('/').pop() || 'file';
            const fileExt = fileName.includes('.') ? fileName.split('.').pop().toLowerCase() : 'jpg';
            const uniqueFileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
            const filePath = isDocument ? `documents/${uniqueFileName}` : `items/${uniqueFileName}`;

            // Determine content type
            let contentType;
            if (isDocument) {
                switch (fileExt) {
                    case 'pdf':
                        contentType = 'application/pdf';
                        break;
                    case 'doc':
                        contentType = 'application/msword';
                        break;
                    case 'docx':
                        contentType = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
                        break;
                    case 'jpg':
                    case 'jpeg':
                        contentType = 'image/jpeg';
                        break;
                    case 'png':
                        contentType = 'image/png';
                        break;
                    default:
                        contentType = 'image/jpeg'; // Default for photos
                }
            } else {
                contentType = `image/${fileExt}`;
            }

            // Upload to Supabase
            const { error, data } = await supabase.storage
                .from('items')
                .upload(filePath, bytes, {
                    contentType,
                    cacheControl: '3600',
                    upsert: false,
                });

            if (error) {
                console.error('Upload error:', error);
                throw error;
            }
            if (!data) throw new Error('No data returned from upload');

            // Get public URL
            const { data: { publicUrl } } = supabase.storage
                .from('items')
                .getPublicUrl(data.path);

            if (!publicUrl) throw new Error('Failed to get public URL');

            return publicUrl;
        } catch (error) {
            console.error('Upload failed:', error);
            throw new Error(`${isDocument ? 'Document' : 'Image'} upload failed: ${error.message}`);
        }
    };

    const validateBillDocument = async (uri) => {
        try {
            const fileInfo = await FileSystem.getInfoAsync(uri);
            
            // Check file size (10MB limit)
            if (fileInfo.size > 10 * 1024 * 1024) {
                Alert.alert('Error', 'Document size should be less than 10MB');
                return false;
            }
            
            // Check if file exists
            if (!fileInfo.exists) {
                Alert.alert('Error', 'Selected file does not exist');
                return false;
            }
            
            // Check file extension
            const fileName = uri.split('/').pop() || '';
            const fileExt = fileName.includes('.') ? fileName.split('.').pop().toLowerCase() : '';
            const allowedExtensions = ['jpg', 'jpeg', 'png', 'pdf', 'doc', 'docx'];
            
            if (!allowedExtensions.includes(fileExt)) {
                Alert.alert('Error', 'Please select a valid document type (JPG, PNG, PDF, DOC, DOCX)');
                return false;
            }
            
            return true;
        } catch (error) {
            console.error('Document validation error:', error);
            Alert.alert('Error', 'Failed to validate document. Please try again.');
            return false;
        }
    };

    const takeBillPhoto = async () => {
        try {
            const { status } = await ImagePicker.requestCameraPermissionsAsync();
            if (status !== 'granted') {
                Alert.alert('Permission needed', 'Please grant camera permissions to take photos');
                return;
            }

            const result = await ImagePicker.launchCameraAsync({
                allowsEditing: true,
                quality: 1,
                mediaTypes: ImagePicker.MediaTypeOptions.Images,
            });

            if (!result.canceled && result.assets && result.assets.length > 0) {
                const asset = result.assets[0];
                
                // Validate the document
                const isValid = await validateBillDocument(asset.uri);
                if (!isValid) return;
                
                setBillDocument(asset.uri);
                setBillDocumentName(asset.uri.split('/').pop() || 'bill_photo.jpg');
                console.log('Bill photo selected:', asset.uri);
            }
        } catch (error) {
            console.error('Camera error:', error);
            Alert.alert('Error', 'Failed to take photo. Please try again.');
        }
    };

    const pickBillFromGallery = async () => {
        try {
            const result = await ImagePicker.launchImageLibraryAsync({
                mediaTypes: ImagePicker.MediaTypeOptions.Images,
                allowsEditing: true,
                quality: 1,
            });

            if (!result.canceled && result.assets && result.assets.length > 0) {
                const asset = result.assets[0];
                
                // Validate the document
                const isValid = await validateBillDocument(asset.uri);
                if (!isValid) return;
                
                setBillDocument(asset.uri);
                setBillDocumentName(asset.uri.split('/').pop() || 'bill_document.jpg');
                console.log('Bill document selected:', asset.uri);
            }
        } catch (error) {
            console.error('Gallery picker error:', error);
            Alert.alert('Error', 'Failed to pick image. Please try again.');
        }
    };

    const showBillDocumentOptions = () => {
        Alert.alert(
            'Upload Bill Document',
            'Choose how you want to upload the bill',
            [
                {
                    text: 'Take Photo',
                    onPress: takeBillPhoto,
                },
                {
                    text: 'Choose from Gallery',
                    onPress: pickBillFromGallery,
                },
                {
                    text: 'Cancel',
                    style: 'cancel',
                },
            ]
        );
    };

    const handleLocationSelect = (locationData) => {
        setItemLocation(locationData);
    };

    const handleUpload = async () => {
        if (!title || !description || !image || !category) {
            Alert.alert('Error', 'Please fill in all fields and select an image');
            return;
        }
        setErrorMsg('');
        try {
            setLoading(true);
            setUploadProgress(0);

            // Upload image first
            console.log('Starting image upload...');
            const imageUrl = await uploadImage(image);
            console.log('Image uploaded successfully:', imageUrl);
            setUploadProgress(30);

            // Upload bill document if provided
            let billUrl = null;
            if (billDocument) {
                try {
                    setBillUploading(true);
                    console.log('Starting bill document upload...');
                    setUploadProgress(35);
                    billUrl = await uploadImage(billDocument, true);
                    console.log('Bill document uploaded successfully:', billUrl);
                    setUploadProgress(60);
                } catch (error) {
                    console.error('Bill document upload failed:', error);
                    Alert.alert(
                        'Bill Upload Failed',
                        'The bill document failed to upload, but your item will still be uploaded. You can add the bill later.',
                        [
                            { text: 'Continue without bill', onPress: () => {} },
                            { text: 'Cancel upload', onPress: () => {
                                setLoading(false);
                                setUploadProgress(0);
                                setBillUploading(false);
                                return;
                            }}
                        ]
                    );
                    // Continue without bill document
                    billUrl = null;
                } finally {
                    setBillUploading(false);
                }
            }

            // Get current user
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) throw new Error('No authenticated user');

            // Ensure user profile exists before uploading item
            const { data: userProfile, error: userProfileError } = await supabase
                .from('users')
                .select('id')
                .eq('id', user.id)
                .maybeSingle();

            if (!userProfile) {
                const { error: insertError } = await supabase.from('users').insert([
                    {
                        id: user.id,
                        email: user.email,
                        created_at: new Date().toISOString(),
                    },
                ]);
                if (insertError) throw insertError;
            }

            // Prepare item data
            const itemData = {
                title,
                description,
                image_url: imageUrl,
                user_id: user.id,
                created_at: new Date().toISOString(),
                status: 'available',
                category: category,
                offering,
                exchangefor,
                bartertype,
            };

            // Add location data if available
            if (itemLocation && itemLocation.latitude && itemLocation.longitude) {
                itemData.latitude = itemLocation.latitude;
                itemData.longitude = itemLocation.longitude;
                itemData.address_street = itemLocation.address.street;
                itemData.address_city = itemLocation.address.city;
                itemData.address_region = itemLocation.address.region;
                itemData.address_postal_code = itemLocation.address.postalCode;
                itemData.address_country = itemLocation.address.country;
                itemData.location_updated_at = new Date().toISOString();
            }

            // Save item data to Supabase
            console.log('Saving item data...');
            const { data: savedItem, error: itemError } = await supabase
                .from('items')
                .insert([itemData])
                .select()
                .single();

            if (itemError) throw itemError;

            // Save bill document if provided
            if (billUrl) {
                try {
                    const fileName = billDocument.split('/').pop() || 'document';
                    const fileExt = fileName.includes('.') ? fileName.split('.').pop().toLowerCase() : 'jpg';
                    
                    const { error: billError } = await supabase
                        .from('bill_documents')
                        .insert([
                            {
                                item_id: savedItem.id,
                                document_url: billUrl,
                                document_type: fileExt,
                            },
                        ]);

                    if (billError) {
                        console.error('Bill document database error:', billError);
                        // Don't throw error here, just log it
                        // The document is uploaded but not linked in database
                    } else {
                        console.log('Bill document saved to database successfully');
                    }
                } catch (error) {
                    console.error('Bill document database insertion error:', error);
                    // Continue without saving bill document to database
                }
            }

            setUploadProgress(100);
            console.log('Item saved successfully');

            // Reset form
            setTitle('');
            setDescription('');
            setImage(null);
            setCategory('');
            setOffering('');
            setExchangefor('');
            setBartertype('Online Barter');
            setBillDocument(null);
            setBillDocumentName('');
            setItemLocation(null);
            setLoading(false);
            setUploadProgress(0);

            // Show success message and navigate
            Alert.alert(
                'Success',
                'Item uploaded successfully!',
                [
                    {
                        text: 'OK',
                        onPress: () => {
                            setTimeout(() => {
                                router.push({ pathname: '/(drawer)/(tabs)/home', params: { refresh: '1' } });
                            }, 100);
                        }
                    }
                ]
            );
        } catch (error) {
            setErrorMsg(error.message || 'Failed to upload item');
            setLoading(false);
            setUploadProgress(0);
            console.error('Upload error:', error);
            Alert.alert('Error', error.message || 'Failed to upload item');
        }
    };

    const testSupabaseUpload = async () => {
        try {
            const blob = new Blob(['Hello, world!'], { type: 'text/plain' });
            const { error, data } = await supabase.storage
                .from('items')
                .upload(`test-${Date.now()}.txt`, blob, {
                    contentType: 'text/plain',
                    upsert: false,
                });
            if (error) {
                console.log('Supabase test upload error:', error);
            } else {
                console.log('Supabase test upload success:', data);
            }
        } catch (err) {
            console.log('Supabase test upload exception:', err);
        }
    };

    useEffect(() => {
        fetch('https://www.google.com')
            .then(res => console.log('Google fetch success:', res.status))
            .catch(err => console.log('Google fetch error:', err));
        testSupabaseUpload();
        const fetchBarterTypes = async () => {
            const { data, error } = await supabase.rpc('get_barter_types');
            if (!error && data && data.length > 0) setBarterTypes(data);
        };
        fetchBarterTypes();
    }, []);

    const isStepComplete = (step) => {
        switch (step) {
            case 1:
                return image !== null;
            case 2:
                return title.trim() !== '' && description.trim() !== '';
            case 3:
                return category !== '';
            case 4:
                return offering.trim() !== '' && exchangefor.trim() !== '';
            case 5:
                return true; // Location is optional
            case 6:
                return true; // Bill document is optional
            default:
                return false;
        }
    };

    const canProceedToNextStep = () => {
        return isStepComplete(currentStep);
    };

    const handleNextStep = () => {
        if (canProceedToNextStep()) {
            setCurrentStep(currentStep + 1);
        } else {
            Alert.alert('Please complete the current step', 'Fill in all required fields before proceeding.');
        }
    };

    const handlePreviousStep = () => {
        setCurrentStep(currentStep - 1);
    };

    if (loading) {
        return (
            <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color="#3B82F6" />
                <Text style={styles.loadingText}>Uploading your item...</Text>
                <View style={styles.progressBarContainer}>
                    <View style={[styles.progressBar, { width: `${uploadProgress}%` }]} />
                </View>
                <Text style={styles.progressText}>{uploadProgress}%</Text>
            </View>
        );
    }

    const renderStepIndicator = () => (
        <View style={styles.stepIndicatorContainer}>
            {[1, 2, 3, 4, 5, 6].map((step, index) => (
                <View key={step} style={styles.stepRow}>
                    <View style={[
                        styles.stepCircle,
                        currentStep === step && styles.activeStepCircle,
                        currentStep > step && styles.completedStepCircle
                    ]}>
                        {currentStep > step ? (
                            <Feather name="check" size={12} color="#fff" />
                        ) : (
                            <Text style={[
                                styles.stepNumber,
                                currentStep === step && styles.activeStepNumber
                            ]}>{step}</Text>
                        )}
                    </View>
                    {index < 5 && <View style={[
                        styles.stepLine,
                        currentStep > step && styles.completedStepLine
                    ]} />}
                </View>
            ))}
        </View>
    );

    const renderStepContent = () => {
        switch (currentStep) {
            case 1:
                return (
                    <View style={styles.stepContent}>
                        <Text style={styles.stepTitle}>Add Photos</Text>
                        <Text style={styles.stepDescription}>Upload clear photos of your item</Text>
                        <TouchableOpacity 
                            style={styles.imageUploadSection} 
                            onPress={showImagePickerOptions}
                        >
                            {image ? (
                                <Image source={{ uri: image }} style={styles.uploadedImage} />
                            ) : (
                                <View style={styles.imagePlaceholder}>
                                    <LinearGradient
                                        colors={['#3B82F6', '#2563EB']}
                                        style={styles.uploadIconContainer}
                                    >
                                        <Feather name="camera" size={32} color="#fff" />
                                    </LinearGradient>
                                    <Text style={styles.uploadText}>Tap to add photo</Text>
                                    <Text style={styles.uploadSubtext}>Choose a clear, well-lit photo</Text>
                                </View>
                            )}
                        </TouchableOpacity>
                    </View>
                );
            case 2:
                return (
                    <View style={styles.stepContent}>
                        <Text style={styles.stepTitle}>Item Details</Text>
                        <Text style={styles.stepDescription}>Tell us about your item</Text>
                        <View style={styles.formGroup}>
                            <Text style={styles.label}>Title</Text>
                            <TextInput
                                style={styles.input}
                                value={title}
                                onChangeText={setTitle}
                                placeholder="Give your item a clear title"
                                placeholderTextColor="#666"
                            />
                        </View>
                        <View style={styles.formGroup}>
                            <Text style={styles.label}>Description</Text>
                            <TextInput
                                style={[styles.input, styles.textArea]}
                                value={description}
                                onChangeText={setDescription}
                                placeholder="Describe your item's condition, features, etc."
                                placeholderTextColor="#666"
                                multiline
                                numberOfLines={4}
                            />
                        </View>
                    </View>
                );
            case 3:
                return (
                    <View style={styles.stepContent}>
                        <Text style={styles.stepTitle}>Category</Text>
                        <Text style={styles.stepDescription}>Choose a category for your item</Text>
                        <TouchableOpacity
                            style={styles.categoryButton}
                            onPress={() => setShowCategoryModal(true)}
                        >
                            <Text style={styles.categoryButtonText}>
                                {category || 'Select a category'}
                            </Text>
                            <Feather name="chevron-down" size={20} color="#666" />
                        </TouchableOpacity>
                    </View>
                );
            case 4:
                return (
                    <View style={styles.stepContent}>
                        <Text style={styles.stepTitle}>Exchange Details</Text>
                        <Text style={styles.stepDescription}>Specify what you're offering and what you want</Text>
                        <View style={styles.formGroup}>
                            <Text style={styles.label}>What You're Offering</Text>
                            <TextInput
                                style={styles.input}
                                value={offering}
                                onChangeText={setOffering}
                                placeholder="Describe what you're offering"
                                placeholderTextColor="#666"
                            />
                        </View>
                        <View style={styles.formGroup}>
                            <Text style={styles.label}>What You Want</Text>
                            <TextInput
                                style={styles.input}
                                value={exchangefor}
                                onChangeText={setExchangefor}
                                placeholder="Describe what you want in exchange"
                                placeholderTextColor="#666"
                            />
                        </View>
                        <View style={styles.formGroup}>
                            <Text style={styles.label}>Barter Type</Text>
                            <View style={styles.barterTypeContainer}>
                                {barterTypes.map((type) => (
                                    <TouchableOpacity
                                        key={type}
                                        style={[
                                            styles.barterTypeButton,
                                            bartertype === type && styles.barterTypeButtonSelected
                                        ]}
                                        onPress={() => setBartertype(type)}
                                    >
                                        <Text style={[
                                            styles.barterTypeText,
                                            bartertype === type && styles.barterTypeTextSelected
                                        ]}>{type}</Text>
                                    </TouchableOpacity>
                                ))}
                            </View>
                        </View>
                    </View>
                );
            case 5:
                return (
                    <View style={styles.stepContent}>
                        <Text style={styles.stepTitle}>Item Location (Optional)</Text>
                        <Text style={styles.stepDescription}>Set the location where this item is available for pickup or exchange</Text>
                        <LocationPicker
                            onLocationSelect={handleLocationSelect}
                            initialLocation={itemLocation}
                            placeholder="Enter item location..."
                        />
                        <Text style={styles.optionalNote}>
                            * Location helps other users find items near them. You can skip this step if you prefer.
                        </Text>
                    </View>
                );
            case 6:
                return (
                    <View style={styles.stepContent}>
                        <Text style={styles.stepTitle}>Add Bill Document (Optional)</Text>
                        <Text style={styles.stepDescription}>Upload a bill or receipt related to your item for fair barter</Text>
                        <TouchableOpacity 
                            style={styles.documentUploadSection} 
                            onPress={showBillDocumentOptions}
                            disabled={billUploading}
                        >
                            {billDocument ? (
                                <View style={styles.selectedDocument}>
                                    <MaterialCommunityIcons name="file-document" size={32} color="#3B82F6" />
                                    <Text style={styles.documentName} numberOfLines={1}>
                                        {billDocumentName}
                                    </Text>
                                    {billUploading ? (
                                        <ActivityIndicator size="small" color="#3B82F6" />
                                    ) : (
                                        <TouchableOpacity 
                                            style={styles.removeDocument}
                                            onPress={() => {
                                                setBillDocument(null);
                                                setBillDocumentName('');
                                            }}
                                        >
                                            <Feather name="x" size={20} color="#666" />
                                        </TouchableOpacity>
                                    )}
                                </View>
                            ) : (
                                <View style={styles.documentPlaceholder}>
                                    <LinearGradient
                                        colors={['#3B82F6', '#2563EB']}
                                        style={styles.uploadIconContainer}
                                    >
                                        <MaterialCommunityIcons name="file-upload" size={32} color="#fff" />
                                    </LinearGradient>
                                    <Text style={styles.uploadText}>
                                        {billUploading ? 'Uploading document...' : 'Tap to upload document'}
                                    </Text>
                                    <Text style={styles.uploadSubtext}>Take a photo or choose from gallery (max 10MB)</Text>
                                </View>
                            )}
                        </TouchableOpacity>
                    </View>
                );
            default:
                return null;
        }
    };

    return (
        <ScrollView style={styles.container}>
            <LinearGradient
                colors={['#3B82F6', '#2563EB']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.header}
            >
                <Text style={styles.headerTitle}>Upload Item</Text>
                {renderStepIndicator()}
            </LinearGradient>

            <View style={styles.content}>
                {renderStepContent()}
            </View>

            <View style={styles.navigationButtons}>
                {currentStep > 1 && (
                    <TouchableOpacity
                        style={styles.backButton}
                        onPress={handlePreviousStep}
                    >
                        <Feather name="arrow-left" size={20} color="#666" />
                        <Text style={styles.backButtonText}>Back</Text>
                    </TouchableOpacity>
                )}
                {currentStep < 6 ? (
                    <TouchableOpacity
                        style={[
                            styles.nextButton,
                            !canProceedToNextStep() && styles.nextButtonDisabled
                        ]}
                        onPress={handleNextStep}
                        disabled={!canProceedToNextStep()}
                    >
                        <Text style={styles.nextButtonText}>Next</Text>
                        <Feather name="arrow-right" size={20} color="#fff" />
                    </TouchableOpacity>
                ) : (
                    <TouchableOpacity
                        style={[
                            styles.uploadButton,
                            !canProceedToNextStep() && styles.uploadButtonDisabled
                        ]}
                        onPress={handleUpload}
                        disabled={!canProceedToNextStep() || loading}
                    >
                        {loading ? (
                            <ActivityIndicator size="small" color="#fff" />
                        ) : (
                            <>
                                <Text style={styles.uploadButtonText}>Upload Item</Text>
                                <Feather name="upload-cloud" size={24} color="#fff" />
                            </>
                        )}
                    </TouchableOpacity>
                )}
            </View>

            <Modal
                visible={showCategoryModal}
                transparent
                animationType="slide"
                onRequestClose={() => setShowCategoryModal(false)}
            >
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>Select Category</Text>
                            <TouchableOpacity 
                                style={styles.modalCloseButton}
                                onPress={() => setShowCategoryModal(false)}
                            >
                                <Feather name="x" size={24} color="#666" />
                            </TouchableOpacity>
                        </View>
                        <ScrollView style={styles.categoryList}>
                            {categories.map((cat) => (
                                <TouchableOpacity
                                    key={cat}
                                    style={[
                                        styles.categoryItem,
                                        category === cat && styles.categoryItemSelected
                                    ]}
                                    onPress={() => {
                                        setCategory(cat);
                                        setShowCategoryModal(false);
                                    }}
                                >
                                    <Text style={[
                                        styles.categoryItemText,
                                        category === cat && styles.categoryItemTextSelected
                                    ]}>{cat}</Text>
                                    {category === cat && (
                                        <Feather name="check" size={20} color="#3B82F6" />
                                    )}
                                </TouchableOpacity>
                            ))}
                        </ScrollView>
                    </View>
                </View>
            </Modal>
        </ScrollView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#fff',
    },
    header: {
        paddingTop: 60,
        paddingBottom: 20,
        borderBottomLeftRadius: 30,
        borderBottomRightRadius: 30,
    },
    headerTitle: {
        fontSize: 24,
        fontWeight: 'bold',
        color: '#fff',
        textAlign: 'center',
        marginBottom: 20,
    },
    stepIndicatorContainer: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 5,
        marginBottom: 20,
    },
    stepRow: {
        flexDirection: 'row',
        alignItems: 'center',
        flex: 1,
    },
    stepCircle: {
        width: 24,
        height: 24,
        borderRadius: 12,
        backgroundColor: '#fff',
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 2,
        borderColor: '#E5E7EB',
    },
    activeStepCircle: {
        backgroundColor: '#3B82F6',
        borderColor: '#3B82F6',
    },
    completedStepCircle: {
        backgroundColor: '#10B981',
        borderColor: '#10B981',
    },
    stepNumber: {
        color: '#666',
        fontSize: 10,
        fontWeight: 'bold',
    },
    activeStepNumber: {
        color: '#fff',
    },
    stepLine: {
        flex: 1,
        height: 2,
        backgroundColor: '#E5E7EB',
        marginHorizontal: 1,
    },
    completedStepLine: {
        backgroundColor: '#10B981',
    },
    content: {
        flex: 1,
        padding: 20,
        paddingBottom: 100, // Add padding to account for fixed navigation
    },
    stepContent: {
        marginBottom: 20,
    },
    stepTitle: {
        fontSize: 22,
        fontWeight: 'bold',
        color: '#1F2937',
        marginBottom: 8,
    },
    stepDescription: {
        fontSize: 16,
        color: '#6B7280',
        marginBottom: 20,
    },
    imageUploadSection: {
        width: '100%',
        height: 250,
        borderRadius: 16,
        overflow: 'hidden',
        backgroundColor: '#F3F4F6',
        borderWidth: 2,
        borderColor: '#E5E7EB',
        borderStyle: 'dashed',
    },
    uploadedImage: {
        width: '100%',
        height: '100%',
        resizeMode: 'cover',
    },
    imagePlaceholder: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    uploadIconContainer: {
        width: 60,
        height: 60,
        borderRadius: 30,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 12,
    },
    uploadText: {
        fontSize: 16,
        fontWeight: '600',
        color: '#1F2937',
        marginBottom: 4,
    },
    uploadSubtext: {
        fontSize: 12,
        color: '#6B7280',
        textAlign: 'center',
    },
    formGroup: {
        marginBottom: 20,
    },
    label: {
        fontSize: 16,
        fontWeight: '600',
        color: '#1F2937',
        marginBottom: 8,
    },
    input: {
        backgroundColor: '#F3F4F6',
        borderRadius: 12,
        padding: 16,
        fontSize: 16,
        color: '#1F2937',
        borderWidth: 1,
        borderColor: '#E5E7EB',
    },
    textArea: {
        height: 120,
        textAlignVertical: 'top',
    },
    categoryButton: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        backgroundColor: '#F3F4F6',
        borderRadius: 12,
        padding: 16,
        borderWidth: 1,
        borderColor: '#E5E7EB',
    },
    categoryButtonText: {
        fontSize: 16,
        color: '#1F2937',
    },
    barterTypeContainer: {
        flexDirection: 'row',
        gap: 12,
    },
    barterTypeButton: {
        flex: 1,
        borderWidth: 1,
        borderColor: '#E5E7EB',
        borderRadius: 12,
        padding: 12,
        alignItems: 'center',
        backgroundColor: '#F3F4F6',
    },
    barterTypeButtonSelected: {
        borderColor: '#3B82F6',
        backgroundColor: '#EBF5FF',
    },
    barterTypeText: {
        fontSize: 14,
        color: '#1F2937',
    },
    barterTypeTextSelected: {
        color: '#3B82F6',
        fontWeight: '600',
    },
    navigationButtons: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginTop: 20,
        paddingHorizontal: 20,
        paddingBottom: 20,
        backgroundColor: '#fff',
        borderTopWidth: 1,
        borderTopColor: '#E5E7EB',
    },
    backButton: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 12,
    },
    backButtonText: {
        marginLeft: 8,
        fontSize: 16,
        color: '#666',
    },
    nextButton: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#3B82F6',
        paddingVertical: 12,
        paddingHorizontal: 20,
        borderRadius: 12,
    },
    nextButtonDisabled: {
        opacity: 0.5,
    },
    nextButtonText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '600',
        marginRight: 8,
    },
    uploadButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#3B82F6',
        paddingVertical: 16,
        paddingHorizontal: 32,
        borderRadius: 12,
        width: '100%',
    },
    uploadButtonDisabled: {
        backgroundColor: '#93C5FD',
    },
    uploadButtonText: {
        color: '#fff',
        fontSize: 18,
        fontWeight: '600',
        marginRight: 12,
    },
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'flex-end',
    },
    modalContent: {
        backgroundColor: '#fff',
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        maxHeight: '80%',
    },
    modalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: 20,
        borderBottomWidth: 1,
        borderBottomColor: '#E5E7EB',
    },
    modalTitle: {
        fontSize: 20,
        fontWeight: 'bold',
        color: '#1F2937',
    },
    modalCloseButton: {
        padding: 4,
    },
    categoryList: {
        padding: 20,
    },
    categoryItem: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: 16,
        paddingHorizontal: 12,
        borderRadius: 12,
        marginBottom: 8,
        backgroundColor: '#F3F4F6',
    },
    categoryItemSelected: {
        backgroundColor: '#EBF5FF',
    },
    categoryItemText: {
        fontSize: 16,
        color: '#1F2937',
    },
    categoryItemTextSelected: {
        color: '#3B82F6',
        fontWeight: '600',
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#fff',
    },
    loadingText: {
        marginTop: 16,
        fontSize: 18,
        color: '#3B82F6',
        fontWeight: '600',
    },
    progressBarContainer: {
        width: '80%',
        height: 4,
        backgroundColor: '#E5E7EB',
        borderRadius: 2,
        marginTop: 16,
        overflow: 'hidden',
    },
    progressBar: {
        height: '100%',
        backgroundColor: '#3B82F6',
        borderRadius: 2,
    },
    progressText: {
        marginTop: 8,
        fontSize: 14,
        color: '#6B7280',
    },
    documentUploadSection: {
        width: '100%',
        height: 150,
        borderRadius: 16,
        overflow: 'hidden',
        backgroundColor: '#F3F4F6',
        borderWidth: 2,
        borderColor: '#E5E7EB',
        borderStyle: 'dashed',
    },
    documentPlaceholder: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20,
    },
    selectedDocument: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 20,
        backgroundColor: '#F3F4F6',
    },
    documentName: {
        flex: 1,
        fontSize: 16,
        color: '#1F2937',
        marginLeft: 12,
    },
    removeDocument: {
        padding: 8,
    },
    optionalNote: {
        fontSize: 12,
        color: '#6B7280',
        marginTop: 8,
    },
}); 