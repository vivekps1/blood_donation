const DonationEntry = require("../models/DonationHistory"); 

const createDonationEntry = async (req, res) => {
  try {
    const newDonationEntry = new DonationEntry(req.body);
    const donationEntry = await newDonationEntry.save();
    return res.status(201).json(donationEntry);
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}

//Get all Donation Entries

const getAllDonationEntries = async (req, res) => {
    try{
        const donationEntries = await DonationEntry.find().sort({createdAt:-1}) ;
        res.status(200).json(donationEntries);
    }catch(error){
        res.status(500).json(error)
    }
}

//Update Donation Entry

const updateDonationEntry = async (req, res) => {
 try{

    const updatedDonationEntry = await DonationEntry.findByIdAndUpdate(
        req.params.id , 
        {$set:req.body}, 
        {new:true}
    )
    res.status(201).json(updatedDonationEntry)
 }  catch(error){
    res.status(500).json(error)
 } 
} ; 

//GET One Donation Entry

const getOneDonationEntry = async (req, res) => {
    try{
        const donationEntry = await DonationEntry.findById(req.params.id) ;
        if (!donationEntry) {
            return res.status(404).json({ message: "Donation Entry not found" });
        }
        res.status(200).json(donationEntry);
    }catch(error){
        res.status(500).json(error)
    }
}

//Delete Donation Entry

const deleteDonationEntry = async (req, res) =>{
    try{
        const donationEntry = await DonationEntry.findByIdAndDelete(req.params.id);
        if (!donationEntry) {
            return res.status(404).json({ message: "Donation Entry not found" });
        }
        res.status(200).json({"message" :"Deleted Donation Entry successfully", donationEntry });
    }catch(error){
        res.status(500).json(error)
    }
}

//Stats 

const getDonationEntriesStats = async (req, res) =>{
    try{

      // Get all donation entries
      const allEntries = await DonationEntry.find().select('userId donationDate status');

      // Group by userId
      const userMap = new Map();
      allEntries.forEach(entry => {
        if (!userMap.has(entry.userId.toString())) {
          userMap.set(entry.userId.toString(), []);
        }
        userMap.get(entry.userId.toString()).push(entry);
      });

      let eligibleDonors = 0;
      let ineligibleDonors = 0;
      let totalDonations = allEntries.length;

      // Get current date/time in IST
      const nowIST = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Kolkata" }));

      userMap.forEach(entries => {
        // Find latest successful donation for this user
        const latestSuccessEntry = entries
          .filter(e => e.status === 'Success' && e.donationDate)
          .sort((a, b) => new Date(b.donationDate) - new Date(a.donationDate))[0];

        let eligibility = "eligible";
        if (latestSuccessEntry && latestSuccessEntry.donationDate) {
          const latestSuccessDate = new Date(latestSuccessEntry.donationDate);
          const diffTime = nowIST.getTime() - latestSuccessDate.getTime();
          const diffDays = diffTime / (1000 * 3600 * 24);
          eligibility = diffDays >= 30 ? "eligible" : "ineligible";
        }
        if (eligibility === "eligible") eligibleDonors++;
        else ineligibleDonors++;
      });

      res.status(200).json({
        eligibleDonors,
        ineligibleDonors,
        totalDonations
      });

    } catch(error) {
      res.status(500).json({ error: error.message });
    }
}

const getDonationEntryIdsByUser = async (req, res) => {
  try {
    const { userId } = req.params;
    let { page = 1, size = 10 } = req.query;
    page = parseInt(page);
    size = parseInt(size);

    // Get all entries for count
    const allEntries = await DonationEntry.find({ userId })
      .select('_id donationDate status')
      .sort({ donationDate: -1 });
    const count = allEntries.length;

    // Paginate for requests
    const entries = allEntries.slice((page - 1) * size, page * size);
    const requests = entries.map(entry => ({
      _id: entry._id,
      Date: entry.donationDate ? new Date(entry.donationDate).toISOString() : null,
      status: entry.status
    }));

    // Find the latest successful donation entry
    const latestSuccessEntry = allEntries.find(entry => entry.status === 'Success' && entry.donationDate);

    // Get current date/time in Indian Standard Time (IST)
    const nowIST = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Kolkata" }));

    let eligibility = "eligible";
    if (latestSuccessEntry && latestSuccessEntry.donationDate) {
      const latestSuccessDate = new Date(latestSuccessEntry.donationDate);
      const diffTime = nowIST.getTime() - latestSuccessDate.getTime();
      const diffDays = diffTime / (1000 * 3600 * 24);
      eligibility = diffDays >= 30 ? "eligible" : "ineligible";
    }

    res.status(200).json({
      count,
      requests,
      eligibility,
      page,
      size,
      totalPages: Math.ceil(count / size)
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

module.exports = {
  deleteDonationEntry,
  getOneDonationEntry,
  getAllDonationEntries,
  getDonationEntriesStats,
  updateDonationEntry,
  createDonationEntry,
  getDonationEntryIdsByUser
};