// API Base URL - Change this if your API runs on a different port
const API_URL = 'http://localhost:5268';

// Check API status on page load
window.addEventListener('DOMContentLoaded', checkApiStatus);

async function checkApiStatus() {
    const statusElement = document.getElementById('api-status');
    
    try {
        // Try a simple endpoint that doesn't require auth
        const response = await fetch(`${API_URL}/api/Games/GetAllGames`, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json'
            }
        });
        
        if (response.ok) {
            statusElement.textContent = '✓ API is Online';
            statusElement.className = 'status online';
        } else if (response.status === 401) {
            statusElement.textContent = '✓ API is Online (Auth Required)';
            statusElement.className = 'status online';
        } else {
            statusElement.textContent = '✗ API Returned Error';
            statusElement.className = 'status offline';
        }
    } catch (error) {
        statusElement.textContent = '✗ API is Offline';
        statusElement.className = 'status offline';
        console.error('API Status Check Error:', error);
    }
}

async function testGetGames() {
    const resultElement = document.getElementById('games-result');
    resultElement.textContent = 'Loading...';
    resultElement.className = 'result';
    
    try {
        const response = await fetch(`${API_URL}/api/Games/GetAllGames`, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json'
            }
        });
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        resultElement.textContent = JSON.stringify(data, null, 2);
        resultElement.className = 'result success';
        
        if (Array.isArray(data) && data.length === 0) {
            resultElement.textContent = 'Success! No games found in database.';
        }
    } catch (error) {
        resultElement.textContent = `Error: ${error.message}\n\nMake sure:\n1. API is running\n2. CORS is enabled\n3. Endpoint exists`;
        resultElement.className = 'result error';
        console.error('Get Games Error:', error);
    }
}

async function testGetPlatforms() {
    const resultElement = document.getElementById('platforms-result');
    resultElement.textContent = 'Loading...';
    resultElement.className = 'result';
    
    try {
        const response = await fetch(`${API_URL}/api/Platforms/GetAllPlatforms`, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json'
            }
        });
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        resultElement.textContent = JSON.stringify(data, null, 2);
        resultElement.className = 'result success';
        
        if (Array.isArray(data) && data.length === 0) {
            resultElement.textContent = 'Success! No platforms found in database.';
        }
    } catch (error) {
        resultElement.textContent = `Error: ${error.message}\n\nMake sure:\n1. API is running\n2. CORS is enabled\n3. Endpoint exists`;
        resultElement.className = 'result error';
        console.error('Get Platforms Error:', error);
    }
}

async function testGetTags() {
    const resultElement = document.getElementById('tags-result');
    resultElement.textContent = 'Loading...';
    resultElement.className = 'result';
    
    try {
        const response = await fetch(`${API_URL}/api/Tags/GetAllTags`, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json'
            }
        });
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        resultElement.textContent = JSON.stringify(data, null, 2);
        resultElement.className = 'result success';
        
        if (Array.isArray(data) && data.length === 0) {
            resultElement.textContent = 'Success! No tags found in database.';
        }
    } catch (error) {
        resultElement.textContent = `Error: ${error.message}\n\nMake sure:\n1. API is running\n2. CORS is enabled\n3. Endpoint exists`;
        resultElement.className = 'result error';
        console.error('Get Tags Error:', error);
    }
}
