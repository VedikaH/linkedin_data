const puppeteer = require('puppeteer');

function delay(time) {
    return new Promise(function(resolve) { 
        setTimeout(resolve, time);
    });
}

async function getCompanyData(companyLink) {
    const browser = await puppeteer.launch({
        args: ['--start-maximized', '--incognito'],
        headless: true,
        defaultViewport: null
    });
    const page = (await browser.pages())[0];

    let [companyName, designation, location] = Array(3).fill('N/A');
    await page.goto(companyLink);
    
    try {
        // Wait for the first list item to load
        await page.waitForSelector('li.profile-section-card.relative.flex', {timeout: 5000});
        
        // Extract the designation (e.g., "Chief Human Resources Officer") from the first list item
        designation = await page.$eval('li.profile-section-card.relative.flex:first-child span.experience-item__title', el => el.textContent.trim());
        
        // Extract the company name (e.g., "NSP") from the first list item
        companyName = await page.$eval('li.profile-section-card.relative.flex:first-child span.experience-item__subtitle', el => el.textContent.trim());

        location = await page.$$eval('li.profile-section-card.relative.flex:first-child p.experience-item__meta-item', elements => {
            return elements[elements.length - 1].textContent.trim();
        });

        await browser.close();
        return {
            'Company Name': companyName,
            'Designation': designation,
            'Location': location
        };
    } catch (error) {
        await browser.close();
        return null;
    }
}

(async () => {
    // Dynamically import node-fetch
    const fetch = (await import('node-fetch')).default;

    // Fetching data from Google Sheet. Assume the Google Doc contains two columns: 'name' and 'URL'
    const response = await fetch('https://script.google.com/macros/s/AKfycbyr6itEQPFX6sQJt8NSY7OokS5YraW5CgXfnYjilZxK0lI_3XOIR6QGpiUXPnsuG-QK7Q/exec');
    
    // Assuming the response from Google Sheets returns an array of objects with 'name' and 'url' fields
    const data = await response.json();
    console.log(data.length);
    
    let result = {};
    
    for (const entry of data) {
        const { name, url } = entry;  // Each entry contains 'name' and 'url' from the Google Doc
        
        let companyData = {
            'Name': name,  // Store the name from the Google Doc
            'URL': url,    // Store the URL
            'Company Name': 'N/A',
            'Designation': 'N/A',
            'Location':'N/A'
        };
        
        try {
            const scrapedData = await getCompanyData(url);  // Scrape data from the URL
            
            if (scrapedData != null) {
                companyData = {
                    ...companyData,  // Include the original name and URL from the Google Doc
                    ...scrapedData  // Add the scraped company name and designation
                };
                console.log(companyData);
                result[url] = companyData;
                if (Object.keys(result).length >= 100) break;
            }
            
            await delay(2000);
        } catch (error) {
            console.log(error);
        }
    }

    try {
        const payload = JSON.stringify({
            'source': 'linkedin',
            'data': result,
        });
        const response = await fetch("https://script.google.com/macros/s/AKfycbzkSce3RgGqFwR8ysG9HjzqEUn8DZqbs4CDvlGBjDmT2I2iOMGNnWsUHbW6dOUx8dkxtg/exec", {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: payload,
        });

        if (!response.ok) {
            throw new Error(`HTTP error! Status: ${response.status}`);
        }
    } catch (error) {
        console.error('Error:', error);
    }
})();
