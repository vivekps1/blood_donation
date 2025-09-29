const Donor = require("../models/Donor") ;

// Create Donor Functionality 

const createDonor = async (req, res) => {
  try {
    const newDonor = new Donor(req.body);
    const donor = await newDonor.save();
    return res.status(201).json(donor); 
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}

//Get all Donors 

const getAlldonors = async (req, res) => {
    try {
        // Get pagination params from query
        let { page = 1, size = 10 } = req.query;
        page = parseInt(page);
        size = parseInt(size);

        const total = await Donor.countDocuments();
        const donors = await Donor.find()
            .sort({ createdAt: -1 })
            .skip((page - 1) * size)
            .limit(size);

        // For each donor, fetch donation stats
        const donorsWithStats = await Promise.all(donors.map(async (donor) => {
            const history = await DonationHistory.find({ userId: donor._id }).sort({ donationDate: -1 });
            const totalDonations = history.length;
            let lastDonationDate = null;
            let lastStatus = null;
            let eligibility = "eligible";
            if (history.length > 0) {
                lastDonationDate = history[0].donationDate || null;
                lastStatus = history[0].status || null;
                // Eligibility logic: last successful donation must be >= 30 days ago
                const latestSuccessEntry = history.find(h => h.status === "Success" && h.donationDate);
                if (latestSuccessEntry && latestSuccessEntry.donationDate) {
                    const nowIST = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Kolkata" }));
                    const latestSuccessDate = new Date(latestSuccessEntry.donationDate);
                    const diffTime = nowIST.getTime() - latestSuccessDate.getTime();
                    const diffDays = diffTime / (1000 * 3600 * 24);
                    eligibility = diffDays >= 30 ? "eligible" : "ineligible";
                }
            }
            return {
                ...donor._doc,
                totalDonations,
                lastDonationDate,
                lastStatus,
                eligibility
            };
        }));

        res.status(200).json({
            donors: donorsWithStats,
            total,
            page,
            size,
            totalPages: Math.ceil(total / size)
        });
    } catch (error) {
        res.status(500).json({ msg: error.message || error });
    }
}

//Update Donor 

const updateDonor = async (req, res) => {
 try{

    const updateDonor = await Donor.findByIdAndUpdate(
        req.params.id , 
        {$set:req.body}, 
        {new:true}
    )
    res.status(201).json(updateDonor)
 }  catch(error){
    res.status(500).json(error)
 } 
} ; 

//GET One Donor 

const getOneDonor = async (req, res) => {
    try{
        const donor = await Donor.findById(req.params.id) ;
        if (!donor) {
            return res.status(404).json({ message: "Donor not found" });
        }
        res.status(200).json(donor)
    }catch(error){
        res.status(500).json(error)
    }
}

//Delete Donor 

const deleteDonor = async (req, res) =>{
    try{
        const donor = await Donor.findByIdAndDelete(req.params.id); 
        if (!donor) {
            return res.status(404).json({ message: "Donor not found" });
        }
        res.status(200).json({"message" :"Deleted Donor successfully", donor });
    }catch(error){
        res.status(500).json(error)
    }
}

//Stats 

const DonationHistory = require("../models/DonationHistory");
const getDonorsStats = async (req, res) => {
    try {
        // Total donors
        const totalDonors = await Donor.countDocuments();
        // Eligible/ineligible donors based on eligibility logic
        const allDonors = await Donor.find();
        let eligibleDonors = 0;
        let ineligibleDonors = 0;
        for (const donor of allDonors) {
            const history = await DonationHistory.find({ userId: donor._id }).sort({ donationDate: -1 });
            let eligibility = "eligible";
            if (history.length > 0) {
                const latestSuccessEntry = history.find(h => h.status === "Success" && h.donationDate);
                if (latestSuccessEntry && latestSuccessEntry.donationDate) {
                    const nowIST = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Kolkata" }));
                    const latestSuccessDate = new Date(latestSuccessEntry.donationDate);
                    const diffTime = nowIST.getTime() - latestSuccessDate.getTime();
                    const diffDays = diffTime / (1000 * 3600 * 24);
                    eligibility = diffDays >= 180 ? "eligible" : "ineligible";
                }
            }
            if (eligibility === "eligible") eligibleDonors++;
            else ineligibleDonors++;
        }
        // Total successful donations
        const totalSuccessDonations = await DonationHistory.countDocuments({ status: "Success" });

        res.status(200).json({
            totalDonors,
            eligibleDonors,
            ineligibleDonors,
            totalSuccessDonations
        });
    } catch (error) {
        res.status(500).json({ msg: error.message || error });
    }
}

module.exports = {deleteDonor, getOneDonor, getAlldonors,getDonorsStats,updateDonor, createDonor}