exports.handler = async (event) => {
  console.log("Running signup function...");
  console.log("GITHUB_TOKEN present?", !!process.env.GITHUB_TOKEN);

  // Handle preflight request
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
      },
      body: ''
    };
  }

  if (event.httpMethod !== 'POST') {
    console.log("Wrong method:", event.httpMethod);
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  try {
    const parsed = JSON.parse(event.body);
    console.log("Parsed event body:", parsed);

    const email = parsed.email;
    if (!email) {
      console.log("No email provided.");
      return { statusCode: 400, body: 'Missing email' };
    }

    const response = await fetch('https://api.github.com/repos/mflanagan201/Macro_release_Calendar/issues', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.GITHUB_TOKEN}`,
        'Accept': 'application/vnd.github.v3+json',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        title: `New Signup: ${email}`,
        body: `Email signup received: ${email}`,
        labels: ['signup']
      })
    });

    const text = await response.text();
    console.log("GitHub response status:", response.status);
    console.log("GitHub response text:", text);

    return {
      statusCode: response.ok ? 200 : 500,
      headers: { 'Access-Control-Allow-Origin': '*' },
      body: response.ok ? 'Signup successful' : 'GitHub Issue creation failed: ' + text
    };

  } catch (error) {
    console.error("Error processing signup:", error);
    return {
      statusCode: 500,
      headers: { 'Access-Control-Allow-Origin': '*' },
      body: 'Internal Server Error: ' + error.message
    };
  }
};
