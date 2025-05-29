package com.example.demo.controller;

import org.springframework.stereotype.Controller;
import org.springframework.web.bind.annotation.GetMapping;

@Controller
public class LogoutRedirectController {
    @GetMapping("/logout")
    public String redirectLogout() {
        return "redirect:/login?logout";
    }
} 