import 'dotenv/config'
import axios from 'axios'

const API_BASE_URL = process.env.API_BASE_URL;
const API_TOKEN = process.env.API_TOKEN;

if (!API_TOKEN) {
    console.error("O token da API não foi configurado no arquivo .env")
}

export const api = axios.create({
    baseURL: API_BASE_URL,
    headers: { 'token': `${API_TOKEN}`},
    timeout: 10000
});