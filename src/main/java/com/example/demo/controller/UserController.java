package com.example.demo.controller;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Controller;
import org.springframework.ui.Model;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.servlet.mvc.support.RedirectAttributes;

import com.example.demo.model.User;
import com.example.demo.service.UserService;

@Controller
public class UserController {
    
    @Autowired
    private UserService service;

    @GetMapping("/welcome") 
    public String welcome() { 
        return "welcome";
    }

    @GetMapping("/user/signup")
    public String showSignupPage(Model model) {
        model.addAttribute("user", new User());
        return "signup";
    }

    @GetMapping("/user/login")
    public String showLoginForm(Model model) {
        model.addAttribute("user", new User());
        return "login";
    }

    @GetMapping("/user/homepage")
    public String showHomePage(Model model) {
        model.addAttribute("user", new User());
        return "homepage";
    }

    @PostMapping("/user/validate")
    public String saveUserForm(User user, RedirectAttributes redi) {
        if (!user.getPassword().equals(user.getConfirmPassword())) {
            redi.addFlashAttribute("error", "Passwords do not match!");
            return "redirect:/user/signup";
        }
        service.save(user);
        redi.addFlashAttribute("message", "User has been saved...");
        return "redirect:/user/homepage";
    }
}
