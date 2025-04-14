export default function About() {
  return (
    <div style={{ padding: '20px', fontFamily: 'Arial, sans-serif' }}>
      <h1>About Us</h1>
      <p>Welcome to our website! We're excited to share our story with you.</p>

      <section style={{ marginTop: '20px' }}>
        <h2>Our Mission</h2>
        <p>
          Our mission is to provide high-quality, user-friendly web applications that make life easier and more enjoyable.
          We focus on simplicity, performance, and great user experience.
        </p>
      </section>

      <section style={{ marginTop: '20px' }}>
        <h2>Our Team</h2>
        <p>
          We are a diverse team of developers, designers, and thinkers dedicated to building innovative products.
          Our team members come from different backgrounds but share a passion for creating exceptional software solutions.
        </p>
      </section>

      <section style={{ marginTop: '20px' }}>
        <h2>Our Values</h2>
        <ul>
          <li><strong>Innovation:</strong> We always strive to think outside the box.</li>
          <li><strong>Integrity:</strong> We believe in doing what's right, not what's easy.</li>
          <li><strong>Collaboration:</strong> We work together to achieve common goals.</li>
        </ul>
      </section>

      <section style={{ marginTop: '20px' }}>
        <h2>Contact Us</h2>
        <p>If you have any questions or feedback, feel free to reach out to us!</p>
        <p>
          Email: <a href="mailto:support@example.com">support@example.com</a>
        </p>
      </section>

      <footer style={{ marginTop: '40px', textAlign: 'center', fontSize: '14px' }}>
        <p>&copy; 2025 Our Company. All rights reserved.</p>
      </footer>
    </div>
  );
}
