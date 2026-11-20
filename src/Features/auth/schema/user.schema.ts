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
    handle: { type: String, default: null },
    alsoAlumni: { type: Boolean, default: false },
    adminRole: { type: Schema.Types.ObjectId, ref: "Role", default: null },
    status: {
        type: String,
        enum : ['ACTIVE','DEACTIVE'],
        default: 'ACTIVE',
    },
},  {timestamps: true})

const User = mongoose.model('User', userSchema);

export default User