package routers

import (
	"os"
	"regexp"
	"strings"
	"testing"

	"github.com/AS203038/looking-glass/pkg/utils"
)

// TestJunosHardeningClassAllowsTemplate verifies that the Junos login class in
// docs/router-hardening.md allows every command of the bundled Junos template.
func TestJunosHardeningClassAllowsTemplate(t *testing.T) {
	doc, err := os.ReadFile("../../docs/router-hardening.md")
	if err != nil {
		t.Fatal(err)
	}
	section := string(doc)
	start := strings.Index(section, "\n## Juniper JunOS")
	if start < 0 {
		t.Fatal("no Juniper JunOS section in docs/router-hardening.md")
	}
	section = section[start+1:]
	if end := strings.Index(section, "\n## "); end >= 0 {
		section = section[:end]
	}
	classRegex := func(statement string) *regexp.Regexp {
		m := regexp.MustCompile(statement + ` "([^"]+)";`).FindStringSubmatch(section)
		if m == nil {
			t.Fatalf("no %s statement in the Juniper JunOS section", statement)
		}
		return regexp.MustCompile(m[1])
	}
	allow, deny := classRegex("allow-commands"), classRegex("deny-commands")

	rt := Get("juniper_junos")
	if rt == nil {
		t.Fatal("juniper_junos template not found in registry")
	}
	cfg := &utils.RouterConfig{
		Name:    "test-router",
		VRF:     "MGMT",
		Source4: &utils.IPNet{IP: "192.0.2.1"},
		Source6: &utils.IPNet{IP: "2001:db8::1"},
	}
	ip4, _ := utils.NewIPNET("192.0.2.10")
	ip6, _ := utils.NewIPNET("2001:db8::10")
	ops := map[string]func() ([]string, error){
		"ping ipv4":       func() ([]string, error) { return rt.Ping(cfg, ip4) },
		"ping ipv6":       func() ([]string, error) { return rt.Ping(cfg, ip6) },
		"traceroute ipv4": func() ([]string, error) { return rt.Traceroute(cfg, ip4) },
		"traceroute ipv6": func() ([]string, error) { return rt.Traceroute(cfg, ip6) },
		"bgp summary":     func() ([]string, error) { return rt.BGPSummary(cfg) },
		"bgp route ipv4":  func() ([]string, error) { return rt.BGPRoute(cfg, ip4) },
		"bgp route ipv6":  func() ([]string, error) { return rt.BGPRoute(cfg, ip6) },
		"community":       func() ([]string, error) { return rt.BGPCommunity(cfg, "65000:100") },
		"large community": func() ([]string, error) { return rt.BGPLargeCommunity(cfg, "65000:100:200") },
		"as path":         func() ([]string, error) { return rt.BGPASPath(cfg, "^65000$") },
	}
	for _, q := range []string{"received", "accepted", "rejected", "advertised"} {
		ops["peer routes "+q] = func() ([]string, error) { return rt.BGPPeerRoutes(cfg, "192.0.2.10", "peer", q) }
	}
	for name, op := range ops {
		cmds, err := op()
		if err != nil || len(cmds) == 0 {
			t.Errorf("%s: cmds=%q err=%v", name, cmds, err)
			continue
		}
		for _, c := range cmds {
			if !allow.MatchString(c) || deny.MatchString(c) {
				t.Errorf("%s: the documented class does not allow %q", name, c)
			}
		}
	}
}
