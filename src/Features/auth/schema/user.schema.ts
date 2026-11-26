const mongoose = require('mongoose')
const Schema = mongoose.Schema;


const userSchema = new Schema({
    email: { type: String, required: true, unique: true, index: true},
    password: { type: String, required: false },
    firstname: {type: String, default: null},
    lastname: {type: String, default: null},
    image: {type: String, default: null},
    phoneNumber: {type: String, default: null},
    profileImage: {type: String, default: null},
    otp: { type: String, required: false },
    role: {
        type: String,
        enum : ['STUDENT','ALUMNI','ADMIN'],
        default: 'STUDENT',
    },
    classYear: { type: Number, default: null },
    program: { type: String, default: null },
    yearGroupSlug: { type: String, default: null },
    communitySlugs: { type: [String], default: [] },
    handle: { type: String, default: null },
    alsoAlumni: { type: Boolean, default: false },
    headline: { type: String, default: "" },
    bio: { type: String, default: "" },
    location: { type: String, default: "" },
    organisation: { type: String, default: "" },
    interests: { type: String, default: "" },
    socials: { type: Schema.Types.Mixed, default: {} },
    notificationPrefs: {
      type: Schema.Types.Mixed,
      default: () => ({
        email: true,
        newsletter: true,
        chat: true,
        events: true,
        scholarships: true,
        resources: true,
        jobs: true,
        giving: true,
      }),
    },
    notificationSeenAt: { type: Date, default: null },
    lastSeenAt: { type: Date, default: null },
    adminRole: { type: Schema.Types.ObjectId, ref: "Role", default: null },
    status: {
        type: String,
        enum : ['ACTIVE','DEACTIVE'],
        default: 'ACTIVE',
    },
},  {timestamps: true})

const User = mongoose.model('User', userSchema);

export default User