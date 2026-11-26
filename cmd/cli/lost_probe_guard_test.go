package main

import (
	"go/ast"
	"go/parser"
	"go/token"
	"io/fs"
	"os"
	"path/filepath"
	"slices"
	"strconv"
	"strings"
	"testing"
)

// rttZeroComparisons returns the position of each comparison of a probe RTT with 0 in src.
// An RTT of 0 is a reply (Cisco IOS prints "0 msec"): a lost probe has no address and no hostname.
func rttZeroComparisons(filename string, src []byte) ([]string, error) {
	fset := token.NewFileSet()
	f, err := parser.ParseFile(fset, filename, src, 0)
	if err != nil {
		return nil, err
	}
	var found []string
	ast.Inspect(f, func(n ast.Node) bool {
		b, ok := n.(*ast.BinaryExpr)
		if !ok || !slices.Contains([]token.Token{token.GTR, token.LSS, token.GEQ, token.LEQ, token.EQL, token.NEQ}, b.Op) {
			return true
		}
		if (isRTT(b.X) && isZero(b.Y)) || (isZero(b.X) && isRTT(b.Y)) {
			found = append(found, fset.Position(b.Pos()).String())
		}
		return true
	})
	return found, nil
}

func isRTT(e ast.Expr) bool {
	if c, ok := e.(*ast.CallExpr); ok && len(c.Args) == 0 {
		s, ok := c.Fun.(*ast.SelectorExpr)
		return ok && s.Sel.Name == "GetRttMs"
	}
	s, ok := e.(*ast.SelectorExpr)
	return ok && s.Sel.Name == "RttMs"
}

func isZero(e ast.Expr) bool {
	l, ok := e.(*ast.BasicLit)
	if !ok || (l.Kind != token.INT && l.Kind != token.FLOAT) {
		return false
	}
	v, err := strconv.ParseFloat(l.Value, 64)
	return err == nil && v == 0
}

func TestRTTZeroComparisonsDetector(t *testing.T) {
	src := `package p
func f(p *pb.TracerouteProbe) {
	_ = p.GetRttMs() > 0
	_ = p.RttMs == 0
	_ = 0.0 != p.RttMs
	_ = p.GetIp() != "" || p.GetHostname() != ""
	_ = p.GetRttMs() > 1
	_ = stats.RttMinMs > 0
}
`
	got, err := rttZeroComparisons("p.go", []byte(src))
	if err != nil {
		t.Fatal(err)
	}
	if want := []string{"p.go:3:6", "p.go:4:6", "p.go:5:6"}; !slices.Equal(got, want) {
		t.Errorf("found %q, want %q", got, want)
	}
}

// A lost-probe test must read the address or the hostname of the probe, not its RTT.
func TestNoLostProbeTestOnRTT(t *testing.T) {
	var found []string
	for _, dir := range []string{"../../cmd", "../../pkg"} {
		err := filepath.WalkDir(dir, func(path string, d fs.DirEntry, err error) error {
			if err != nil || d.IsDir() || !strings.HasSuffix(path, ".go") || strings.HasSuffix(path, "_test.go") {
				return err
			}
			src, err := os.ReadFile(path)
			if err != nil {
				return err
			}
			pos, err := rttZeroComparisons(path, src)
			found = append(found, pos...)
			return err
		})
		if err != nil {
			t.Fatal(err)
		}
	}
	if len(found) > 0 {
		t.Errorf("an RTT of 0 is a reply; test the probe address or hostname instead:\n%s", strings.Join(found, "\n"))
	}
}
