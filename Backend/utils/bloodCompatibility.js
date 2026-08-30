// Blood group compatibility rules (ABO + Rh).
//
// The synopsis (section 9.b.2 "Process Logic of Modules") requires eligibility to be
// verified through "blood group compatibility". Prior to this module the code only ever
// compared blood group strings for exact equality, which wrongly excluded universal
// donors (an O- donor could not be matched to an A+ patient).

const BLOOD_GROUPS = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];

// recipient blood group -> donor blood groups that may donate to them
const CAN_RECEIVE_FROM = {
    'A+':  ['A+', 'A-', 'O+', 'O-'],
    'A-':  ['A-', 'O-'],
    'B+':  ['B+', 'B-', 'O+', 'O-'],
    'B-':  ['B-', 'O-'],
    'AB+': ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'],
    'AB-': ['A-', 'B-', 'AB-', 'O-'],
    'O+':  ['O+', 'O-'],
    'O-':  ['O-']
};

// Normalise the many shapes blood groups arrive in ("o positive", "A Pos", "ab+")
const normalize = (group) => {
    if (!group) return null;
    let g = String(group).trim().toUpperCase().replace(/\s+/g, '');
    g = g.replace(/POSITIVE$|POS$/, '+').replace(/NEGATIVE$|NEG$/, '-');
    return BLOOD_GROUPS.includes(g) ? g : null;
};

// Can a donor of `donorGroup` give blood to a patient of `recipientGroup`?
const isCompatible = (donorGroup, recipientGroup) => {
    const donor = normalize(donorGroup);
    const recipient = normalize(recipientGroup);
    if (!donor || !recipient) return false;
    return CAN_RECEIVE_FROM[recipient].includes(donor);
};

// All donor groups that can serve a given patient — used to build DB queries.
const compatibleDonorGroups = (recipientGroup) => {
    const recipient = normalize(recipientGroup);
    return recipient ? [...CAN_RECEIVE_FROM[recipient]] : [];
};

// All patient groups a given donor can serve — used for donor-facing "you can help" views.
const compatibleRecipientGroups = (donorGroup) => {
    const donor = normalize(donorGroup);
    if (!donor) return [];
    return BLOOD_GROUPS.filter(recipient => CAN_RECEIVE_FROM[recipient].includes(donor));
};

module.exports = {
    BLOOD_GROUPS,
    normalize,
    isCompatible,
    compatibleDonorGroups,
    compatibleRecipientGroups
};
