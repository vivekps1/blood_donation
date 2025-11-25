const Hospital = require("../models/Hospital") ;

// Create Hospital Functionality 

const createHospital = async (req, res) =>{
try{
    // console.log(req.body)
    const payload = { ...req.body };
    // If front-end sent latitude/longitude, normalize into GeoJSON for storage
    if (payload.latitude !== undefined && payload.longitude !== undefined) {
        const lat = parseFloat(payload.latitude);
        const lng = parseFloat(payload.longitude);
        if (!isNaN(lat) && !isNaN(lng)) {
            payload.locationGeo = { type: 'Point', coordinates: [lng, lat] };
        }
    }
    // Normalize hospitalId to string if provided
    if (payload.hospitalId != null) {
        payload.hospitalId = String(payload.hospitalId);
    }
    // Auto-generate a hospitalId if none supplied (simple timestamp-based ID)
    if (!payload.hospitalId) {
        payload.hospitalId = `H-${Date.now()}`;
    }
    // Convert isVerified from possible 'true'/'false' strings to Boolean
    if (typeof payload.isVerified === 'string') {
        payload.isVerified = payload.isVerified === 'true';
    }
    // Normalize incoming lat/lng or hospitalLocationGeo into GeoJSON Point
    if (typeof payload.lat !== 'undefined' && typeof payload.lng !== 'undefined') {
        const lat = Number(payload.lat);
        const lng = Number(payload.lng);
        if (!Number.isNaN(lat) && !Number.isNaN(lng)) {
            payload.hospitalLocationGeo = { type: 'Point', coordinates: [lng, lat] };
        }
        delete payload.lat;
        delete payload.lng;
    } else if (payload.hospitalLocationGeo && payload.hospitalLocationGeo.type === 'Point') {
        const coords = payload.hospitalLocationGeo.coordinates;
        if (!Array.isArray(coords) || coords.length !== 2) {
            delete payload.hospitalLocationGeo;
        } else {
            payload.hospitalLocationGeo.coordinates = [Number(coords[0]), Number(coords[1])];
        }
    }
    const newHospital = Hospital(payload) ; 
    const hospital = await newHospital.save() ; 
    res.status(201).json(hospital)

}catch(error){
    res.status(500).json(error) ;
}

}

//Get all Hospitals 

const getAllHospitals = async (req, res) => {
    try {
        // Get pagination and filter/sort params from query
        let { page = 1, size = 10, sortField, sortOrder, search, isVerified } = req.query;
        page = parseInt(page);
        size = parseInt(size);

        // Build mongo query
        const mongoQuery = {};
        if (search) {
            const re = new RegExp(String(search), 'i');
            mongoQuery.hospitalName = re;
        }

        // Add isVerified filter if provided
        if (isVerified !== undefined && isVerified !== null && isVerified !== '') {
            mongoQuery.isVerified = isVerified === 'true';
        }

        // Prepare sort - default to createdAt descending
        let sortObj = { createdAt: -1 };
        if (sortField) {
            const order = sortOrder === 'asc' ? 1 : -1;
            // Only allow sorting by specific fields to avoid injection
            if (['hospitalName', 'createdAt'].includes(sortField)) {
                sortObj = { [sortField]: order };
            }
        }

        // Get total count for pagination
        const total = await Hospital.countDocuments(mongoQuery);
        const totalPages = Math.ceil(total / size) || 1;

        // Fetch hospitals with pagination and sorting
        const hospitals = await Hospital.find(mongoQuery)
            .sort(sortObj)
            .skip((page - 1) * size)
            .limit(size)
            .lean();

        res.status(200).json({ hospitals, total, page, size, totalPages });
    } catch (error) {
        res.status(500).json(error);
    }
}

//Update Hospital 

const updateHospital = async (req, res) => {
 try{
    console.log(req.body)
    if(Object.keys(req.body).length == 0){
        return res.status(204).json("Nothing updated")
    }
    const updatePayload = { ...req.body };
    // Map latitude/longitude to GeoJSON if provided
    if (updatePayload.latitude !== undefined && updatePayload.longitude !== undefined) {
        const lat = parseFloat(updatePayload.latitude);
        const lng = parseFloat(updatePayload.longitude);
        if (!isNaN(lat) && !isNaN(lng)) {
            updatePayload.locationGeo = { type: 'Point', coordinates: [lng, lat] };
        }
    }
    if (updatePayload.hospitalId != null) {
        updatePayload.hospitalId = String(updatePayload.hospitalId);
    }
    if (typeof updatePayload.isVerified === 'string') {
        updatePayload.isVerified = updatePayload.isVerified === 'true';
    }
    // Normalize incoming lat/lng or hospitalLocationGeo into GeoJSON Point
    if (typeof updatePayload.lat !== 'undefined' && typeof updatePayload.lng !== 'undefined') {
        const lat = Number(updatePayload.lat);
        const lng = Number(updatePayload.lng);
        if (!Number.isNaN(lat) && !Number.isNaN(lng)) {
            updatePayload.hospitalLocationGeo = { type: 'Point', coordinates: [lng, lat] };
        }
        delete updatePayload.lat;
        delete updatePayload.lng;
    } else if (updatePayload.hospitalLocationGeo && updatePayload.hospitalLocationGeo.type === 'Point') {
        const coords = updatePayload.hospitalLocationGeo.coordinates;
        if (!Array.isArray(coords) || coords.length !== 2) {
            delete updatePayload.hospitalLocationGeo;
        } else {
            updatePayload.hospitalLocationGeo.coordinates = [Number(coords[0]), Number(coords[1])];
        }
    }
    const updateHospital = await Hospital.findByIdAndUpdate(
        req.params.id , 
        {$set:updatePayload}, 
        {new:true}
    )
    res.status(200).json(updateHospital)
 }  catch(error){
    res.status(500).json(error)
 } 
} ; 

// Get nearby hospitals based on lat,lng and optional radius (meters)
const getNearbyHospitals = async (req, res) => {
    try {
        const { lat, lng, radius } = req.query;
        if (!lat || !lng) {
            return res.status(400).json({ message: 'lat and lng query params are required' });
        }
        const latitude = parseFloat(lat);
        const longitude = parseFloat(lng);
        const maxDistance = radius ? parseInt(radius) : 5000; // default 5km

        const hospitals = await Hospital.find({
            locationGeo: {
                $near: {
                    $geometry: { type: 'Point', coordinates: [longitude, latitude] },
                    $maxDistance: maxDistance
                }
            }
        });
        res.status(200).json(hospitals);
    } catch (error) {
        res.status(500).json(error);
    }
}

//GET One Hospital 

const getOneHospital = async (req, res) => {
    try{
        const hospital = await Hospital.findById(req.params.id) ;
        if (!hospital) {
            return res.status(404).json({ message: "Hospital not found" });
        }
        res.status(200).json(hospital)
    }catch(error){
        res.status(500).json(error)
    }
}

//Delete Hospital 

const deleteHospital = async (req, res) =>{
    try{
        const hospital = await Hospital.findByIdAndDelete(req.params.id); 
         if (!hospital) {
            return res.status(404).json({ message: "Hospital not found" });
        }
        res.status(200).json({"message" :"Deleted hospital successfully", hospital });
    }catch(error){
        res.status(500).json(error)
    }
}

//Stats 

const getHospitalStats = async (req, res) =>{

    try{
        id = req._id
        const stats = await Hospital.aggregate([
            {
                $group:{
                    _id:"$hospitalId",
                    count: {$sum:1}
                }
            }
        ]) ; 
        res.status(200).json(stats) ;

    }catch(error){
        res.status(500).json(error) ; 
        
    }
}

module.exports = {deleteHospital, getOneHospital, getAllHospitals,getHospitalStats,updateHospital, createHospital, getNearbyHospitals}