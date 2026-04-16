import React from "react";
import { Container } from "react-bootstrap";

const Footer = () => {
  return (
    <footer className="py-5">
      <Container>{`${new Date().getFullYear()} - © Strive School | Developed for homework projects.`}</Container>
    </footer>
  );
};

export default Footer;
