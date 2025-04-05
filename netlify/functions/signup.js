exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  const { email } = JSON.parse(event.body);

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

  if (!response.ok) {
    return { statusCode: 500, body: 'GitHub Issue creation failed' };
  }

  return { statusCode: 200, body: 'Signup successful' };
};