import * as admin from 'firebase-admin';
import * as functions from 'firebase-functions/v2';
import { onDocumentDeleted } from 'firebase-functions/v2/firestore';
import { CallableRequest } from 'firebase-functions/v2/https';
import sharp from 'sharp';
import { v4 } from 'uuid';
import { BUSINESS_COLLECTION, IMAGES_COLLECTION } from '..';

interface IUploadImagesProps {
    images: string[];
    type?: 'products' | '';
}

export const UploadImages = functions.https.onCall(async (request: CallableRequest<IUploadImagesProps>) => {
    // Validate authentication
    if (!request.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated to upload images.');
    }

    // Get user and business details
    const userRecord = await admin.auth().getUser(request.auth.uid);
    const businessId = userRecord.customClaims?.business as string;

    // Default to 'products' if no type specified
    const type = request.data?.type || 'products';

    // Validate input
    if (!request.data?.images || request.data.images.length === 0) {
        throw new functions.https.HttpsError('invalid-argument', 'No images provided');
    }

    try {
        // Process images in parallel
        const uploadResults = await Promise.all(
            request.data.images.map((base64Image, index) =>
                processImage(base64Image, businessId, type, index, request.auth!.uid),
            ),
        );

        return {
            success: true,
            uploads: uploadResults,
        };
    } catch (error) {
        console.error('Image upload error:', error);

        // Provide more detailed error handling
        if (error instanceof functions.https.HttpsError) {
            throw error;
        }

        throw new functions.https.HttpsError(
            'internal',
            'Failed to upload images',
            error instanceof Error ? error.message : String(error),
        );
    }
});

const processImage = async (
    base64Image: string,
    businessId: string,
    type: string,
    index: number,
    uploaderId: string,
) => {
    // Robust image type detection
    const typeMatch = base64Image.match(/^data:image\/(jpeg|jpg|png);base64,/i);
    if (!typeMatch) {
        throw new functions.https.HttpsError('invalid-argument', `Invalid image format for image ${index}`);
    }

    // Normalize image type
    const imageType = typeMatch[1].toLowerCase();
    const base64Data = base64Image.replace(/^data:image\/(jpeg|jpg|png);base64,/i, '');

    // Convert buffer
    const buffer = Buffer.from(base64Data, 'base64');

    // Generate unique filename and document ID
    const uuid = v4();
    const filename = `${businessId}/${type}/images/original/${uuid}.jpg`;
    const thumbnailFilename = `${businessId}/${type}/images/thumbnail/${uuid}.jpg`;

    // Process and upload original image
    const processedBuffer = await sharp(buffer)
        .toColorspace('srgb') // Normalize color space
        .jpeg({ quality: 90 }) // Convert to high-quality JPEG
        .toBuffer();

    const bucket = admin.storage().bucket();
    const firestore = admin.firestore();

    // Upload original image
    const originalFile = bucket.file(filename);
    await originalFile.save(processedBuffer, {
        metadata: {
            contentType: 'image/jpeg',
            metadata: {
                uploadedBy: uploaderId,
                originalFormat: imageType,
            },
        },
        public: true,
    });

    // Make the file publicly accessible
    await originalFile.makePublic();

    // Create thumbnail
    const thumbnailBuffer = await sharp(processedBuffer)
        .resize(200, 200, {
            fit: 'cover',
            position: 'center',
        })
        .jpeg({ quality: 85 }) // Slightly lower quality for thumbnails
        .toBuffer();

    const thumbnailFile = bucket.file(thumbnailFilename);
    await thumbnailFile.save(thumbnailBuffer, {
        metadata: {
            contentType: 'image/jpeg',
            metadata: {
                originalImage: filename,
                uploadedBy: uploaderId,
                originalFormat: imageType,
            },
        },
        public: true,
    });

    // Make the thumbnail file publicly accessible
    await thumbnailFile.makePublic();

    // Get public URLs
    const originalUrl = originalFile.publicUrl();
    const thumbnailUrl = thumbnailFile.publicUrl();

    // Prepare Firestore document
    const imageDoc = {
        id: uuid,
        businessId,
        type,
        originalFormat: imageType,
        uploadedBy: uploaderId,
        originalFile: filename,
        thumbnailFile: thumbnailFilename,
        originalUrl,
        thumbnailUrl,
        createdAt: new Date(),
        metadata: {
            size: processedBuffer.length,
            originalSize: buffer.length,
            height: await sharp(processedBuffer)
                .metadata()
                .then((m) => m.height),
            width: await sharp(processedBuffer)
                .metadata()
                .then((m) => m.width),
        },
    };

    // Save to Firestore
    const imageRef = firestore.collection(BUSINESS_COLLECTION).doc(businessId).collection(IMAGES_COLLECTION).doc(uuid);
    await imageRef.set(imageDoc);

    return {
        ...imageDoc,
        id: imageRef.id,
    };
};

export const onImageDeleted = onDocumentDeleted(
    `${BUSINESS_COLLECTION}/{businessId}/${IMAGES_COLLECTION}{imageId}`,
    async (event) => {
        console.log('Deleting document', event);
        const deletedImageSnapshot = event.data;

        if (!deletedImageSnapshot) {
            console.error('No data found for deleted document.');
            return;
        }
        const deletedImageData = deletedImageSnapshot.data();

        const { originalFile, thumbnailFile } = deletedImageData;

        try {
            // Delete the original file
            const bucket = admin.storage().bucket();
            if (originalFile) {
                const originalFileRef = bucket.file(originalFile);
                await originalFileRef.delete();
                console.log(`Deleted original file: ${originalFile}`);
            } else {
                console.warn('No original file reference found in the deleted document.');
            }

            // Delete the thumbnail file
            if (thumbnailFile) {
                const thumbnailFileRef = bucket.file(thumbnailFile);
                await thumbnailFileRef.delete();
                console.log(`Deleted thumbnail file: ${thumbnailFile}`);
            } else {
                console.warn('No thumbnail file reference found in the deleted document.');
            }
        } catch (error) {
            console.error('Error deleting files:', error);
        }
    },
);
