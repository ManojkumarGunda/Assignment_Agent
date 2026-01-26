import api from './axios';

const historyApi = {
    getHistory: async (params = {}) => {
        const response = await api.get('/history', { params });
        return response.data;
    },
    getHistoryDetail: async (id) => {
        const response = await api.get(`/history/${id}`);
        return response.data;
    },
    deleteHistory: async (id) => {
        const response = await api.delete(`/history/${id}`);
        return response.data;
    }
};

export default historyApi;
