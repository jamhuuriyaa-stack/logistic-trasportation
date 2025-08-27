import axios from 'axios';

const API_URL = '/api/auth/';

const register = (email, password, fullName, phoneNumber, role) => {
    return axios.post(API_URL + 'register', {
        email,
        password,
        full_name: fullName,
        phone_number: phoneNumber,
        role,
    });
};

const login = async (email, password) => {
    const response = await axios.post(API_URL + 'login', {
        email,
        password,
    });
    if (response.data.token) {
        localStorage.setItem('user', JSON.stringify(response.data));
    }
    return response.data;
};

const logout = () => {
    localStorage.removeItem('user');
};

const getCurrentUser = () => {
    return JSON.parse(localStorage.getItem('user'));
};

const authService = {
    register,
    login,
    logout,
    getCurrentUser,
};

export default authService;
