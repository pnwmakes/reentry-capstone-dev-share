import { NextRequest, NextResponse } from 'next/server';
import { collection, getDocs, orderBy, query } from 'firebase/firestore';
import { db } from '../../../lib/Firebase';
import { Location } from '@/types';
import { createNewLocation } from '@/services/locationServices';

/**
 * Handles GET requests to retrieve a list of all locations.
 * @param request The incoming Next.js request object.
 * @returns A NextResponse object with the locations or an error message.
 */
export async function GET() {
    try {
        const locationsCollectionRef = collection(db, 'locations');
        const q = query(locationsCollectionRef, orderBy('name'));
        const querySnapshot = await getDocs(q);

        const locations: Location[] = [];
        querySnapshot.forEach(doc => {
            const data = doc.data();

            if (data.coordinates && data.coordinates.latitude !== undefined && data.coordinates.longitude !== undefined) {
                data.coordinates = {
                    latitude: data.coordinates.latitude,
                    longitude: data.coordinates.longitude
                };
            }

            locations.push({
                id: doc.id,
                ...data as Omit<Location, 'id'>
            });
        });


        return NextResponse.json(locations, { status: 200 });
    } catch (error) {
        console.error('Error fetching locations:', error);
        return NextResponse.json({ message: 'Error fetching locations' }, { status: 500 });
    }
}

/**
 * Handles POST requests to create a new location.
 * @param request The incoming Next.js request object containing the new location data.
 * @returns A NextResponse object with a success message or an error.
 */
export async function POST(request: NextRequest) {
    try {

        const newLocationData = await request.json();

        if (!newLocationData.name || !newLocationData.address) {
            return NextResponse.json({ message: 'Missing required location data: name or address.' }, { status: 400 });
        }

        const newLocationId = await createNewLocation(newLocationData);

        return NextResponse.json({
            message: 'Location created successfully!',
            id: newLocationId
        }, { status: 201 });

    } catch (error) {
        console.error('Error creating new location:', error);
        return NextResponse.json({ message: 'Error creating new location' }, { status: 500 });
    }
}

